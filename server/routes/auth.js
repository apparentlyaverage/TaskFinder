// server/routes/auth.js — local auth + Google OAuth (merged from services/auth)
import { Router } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { pool } from '../db.js'
import { requireAuth } from '../middleware.js'
import { validateLocationName, resolveLocationId } from '../locationValidate.js'
import log from '../log.js'

const router = Router()
const SALT_ROUNDS  = 12
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// Current POPIA consent version — bump when the privacy policy materially changes,
// so we can tell exactly who consented to which version.
const POPIA_CONSENT_VERSION = '2026-06-v1'

// Capture the real client IP behind the proxy (Railway/Vercel set x-forwarded-for)
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return String(fwd).split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || null
}

// Campus/zone is validated against the data-driven `locations` table via
// isValidLocationName — constrained (no junk) but extensible to new campuses
// without a code change. See server/locationValidate.js.

// Normalise a SA-style phone to digits (+ optional leading +). Returns null if junk.
function normalizePhone(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null
  const cleaned = String(raw).replace(/[^\d+]/g, '')
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 15) throw new Error('Please enter a valid phone number.')
  return cleaned.startsWith('+') ? cleaned : digits
}

function issueToken(user) {
  return jwt.sign(
    { userId: user.user_id, role: user.role, email: user.email, tv: user.token_version ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// ── Google strategy — identical 3-branch logic from the standalone service ───
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const googleId    = profile.id
      const googleEmail = profile.emails?.[0]?.value
      const displayName = profile.displayName || googleEmail?.split('@')[0] || 'Google User'
      const avatarUrl   = profile.photos?.[0]?.value?.replace('=s96-c', '=s200-c')
      if (!googleEmail) throw new Error('Google account has no email address.')

      // 1. Returning Google user
      let { rows } = await client.query(
        `SELECT u.user_id, u.email, u.role, up.display_name, up.avatar_url
         FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.google_id = $1`, [googleId])
      if (rows.length > 0) {
        await client.query('COMMIT')
        // Avatar refresh is best-effort — must never break login if column is absent
        pool.query('UPDATE user_profiles SET avatar_url=$1 WHERE user_id=$2', [avatarUrl, rows[0].user_id]).catch(() => {})
        return done(null, { ...rows[0], google_avatar_url: avatarUrl })
      }

      // 2. Same email exists — link Google to it
      ;({ rows } = await client.query(
        `SELECT u.user_id, u.email, u.role, up.display_name, up.avatar_url
         FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.email = $1`, [googleEmail]))
      if (rows.length > 0) {
        await client.query('UPDATE users SET google_id=$1 WHERE user_id=$2', [googleId, rows[0].user_id])
        await client.query('COMMIT')
        // Best-effort enrichment — won't break login if these columns are missing
        pool.query(`UPDATE users SET google_email=$1, google_avatar_url=$2, is_email_verified=TRUE WHERE user_id=$3`,
          [googleEmail, avatarUrl, rows[0].user_id]).catch(() => {})
        pool.query('UPDATE user_profiles SET avatar_url=$1 WHERE user_id=$2', [avatarUrl, rows[0].user_id]).catch(() => {})
        return done(null, { ...rows[0], google_avatar_url: avatarUrl })
      }

      // 3. Brand new user — Google verifies the email (is_email_verified=TRUE is
      //    legitimate), but Google does NOT capture POPIA consent on our behalf.
      //    So consent starts FALSE and the user is prompted for REAL consent
      //    (interstitial) before they can use the app. Never fabricate consent.
      ;({ rows } = await client.query(
        `INSERT INTO users (email, role, google_id, google_email, google_avatar_url,
           is_email_verified, popia_consent, popia_consent_at)
         VALUES ($1, 'member', $2, $3, $4, TRUE, FALSE, NULL)
         RETURNING user_id, email, role`,
        [googleEmail, googleId, googleEmail, avatarUrl]))
      const newUser = rows[0]
      await client.query(
        'INSERT INTO user_profiles (user_id, display_name) VALUES ($1,$2)',
        [newUser.user_id, displayName])
      await client.query('COMMIT')
      pool.query('UPDATE user_profiles SET avatar_url=$1 WHERE user_id=$2', [avatarUrl, newUser.user_id]).catch(() => {})

      pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, 'member', 'user.registered', 'user', $1, $2)`,
        [newUser.user_id, JSON.stringify({ provider: 'google', email: googleEmail })]
      ).catch(() => {})

      return done(null, { ...newUser, display_name: displayName, avatar_url: avatarUrl, google_avatar_url: avatarUrl })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('auth.google_strategy_failed', { msg: err.message })
      return done(err)
    } finally {
      client.release()
    }
  }
))

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account', session: false })
)

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/?auth_error=google_failed`,
    session: false,
  }),
  async (req, res) => {
    try {
      const user  = req.user
      // Pull the current token_version so a Google sign-in after a prior logout
      // (which bumps it) isn't issued an already-revoked token. New users → 0.
      const tvRow = await pool.query('SELECT token_version FROM users WHERE user_id = $1', [user.user_id])
      user.token_version = tvRow.rows[0]?.token_version ?? 0
      const token = issueToken(user)
      const { rows } = await pool.query(
        'SELECT display_name, avatar_url FROM user_profiles WHERE user_id = $1', [user.user_id])
      const displayName = rows[0]?.display_name || user.display_name || user.email?.split('@')[0] || 'User'
      const avatarUrl   = rows[0]?.avatar_url   || user.google_avatar_url || ''

      // Does this user still need to give POPIA consent? (new Google users do)
      const consentRow = await pool.query('SELECT popia_consent FROM users WHERE user_id = $1', [user.user_id])
      const needsConsent = consentRow.rows[0]?.popia_consent === false

      pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.login', 'user', $1, $3)`,
        [user.user_id, user.role, JSON.stringify({ provider: 'google' })]
      ).catch(() => {})

      const params = new URLSearchParams({
        token, userId: user.user_id, email: user.email, role: user.role, displayName, avatarUrl,
        needsConsent: needsConsent ? '1' : '0',
      })
      res.redirect(`${FRONTEND_URL}/oauth-callback?${params.toString()}`)
    } catch (err) {
      log.error('auth.google_callback_failed', { reqId: req.id, msg: err.message })
      res.redirect(`${FRONTEND_URL}/?auth_error=callback_failed`)
    }
  }
)

router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['member']),
    body('displayName').optional().trim().isLength({ max: 100 }),
    body('phoneNumber').optional({ nullable: true }).trim().isLength({ max: 25 }),
    body('campusZone').optional({ nullable: true }).trim().custom(validateLocationName),
    body('bio').optional({ nullable: true }).trim().isLength({ max: 1000 }),
    body('popiaConsent').custom(v => v === true || v === 'true')
      .withMessage('You must accept the privacy policy to register.'),
  ],
  check,
  async (req, res) => {
    const { email, password, role = 'member', displayName, campusZone, bio } = req.body

    // Validate + normalise the phone (throws → caught below as 422)
    let phoneNumber
    try { phoneNumber = normalizePhone(req.body.phoneNumber) }
    catch (e) { return res.status(422).json({ message: e.message }) }

    // Skills may arrive as array or comma-string — normalise to a Postgres array
    let skills = null
    if (req.body.skills !== undefined && req.body.skills !== null) {
      skills = Array.isArray(req.body.skills)
        ? req.body.skills
        : String(req.body.skills).split(',').map(s => s.trim()).filter(Boolean)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email])
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Email already registered.' })
      }
      const hash = await bcrypt.hash(password, SALT_ROUNDS)
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, role, phone_number,
           popia_consent, popia_consent_at, popia_consent_ip, popia_consent_version)
         VALUES ($1, $2, $3, $4, TRUE, NOW(), $5, $6)
         RETURNING user_id, email, role`,
        [email, hash, role, phoneNumber || null, clientIp(req), POPIA_CONSENT_VERSION])
      const newUser = rows[0]
      const locationId = await resolveLocationId(campusZone)   // best-effort FK (TD-12)
      await client.query(
        `INSERT INTO user_profiles (user_id, display_name, campus_zone, location_id, skills, bio)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newUser.user_id, displayName || email.split('@')[0], campusZone || null, locationId, skills, bio || null])
      await client.query('COMMIT')

      pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.registered', 'user', $1, $3)`,
        [newUser.user_id, role, JSON.stringify({ provider: 'email', email })]
      ).catch(() => {})

      return res.status(201).json({
        token: issueToken(newUser),
        user: { userId: newUser.user_id, email: newUser.email, role: newUser.role,
                displayName: displayName || email.split('@')[0] },
      })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('auth.register_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  check,
  async (req, res) => {
    const { email, password } = req.body
    try {
      const { rows } = await pool.query(
        `SELECT u.user_id, u.email, u.role, u.password_hash, u.token_version, up.display_name, up.avatar_url
         FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.email = $1`, [email])
      if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' })
      const user = rows[0]
      if (!user.password_hash) {
        return res.status(401).json({ message: 'This account uses Google Sign-In. Please click the "Sign in with Google" button.' })
      }
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) return res.status(401).json({ message: 'Invalid credentials.' })

      pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.login', 'user', $1, $3)`,
        [user.user_id, user.role, JSON.stringify({ provider: 'email' })]
      ).catch(() => {})

      return res.status(200).json({
        token: issueToken(user),
        user: { userId: user.user_id, email: user.email, role: user.role,
                displayName: user.display_name || email.split('@')[0],
                avatarUrl: user.avatar_url || null },
      })
    } catch (err) {
      log.error('auth.login_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /auth/me — now JWT-verified instead of trusting a header
router.get('/me', async (req, res) => {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized.' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query(
      `SELECT u.user_id, u.email, u.role, u.google_id, u.google_avatar_url,
              u.popia_consent, u.token_version,
              up.display_name, up.avg_rating, up.avatar_url, up.skills, up.bio
       FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`, [payload.userId])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' })
    if (rows[0].token_version !== (payload.tv ?? 0)) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }
    const { token_version, ...safeUser } = rows[0]
    return res.status(200).json({ user: safeUser })
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
})

// POST /auth/consent — record a REAL, explicit POPIA consent action.
// Used by the consent interstitial (chiefly the Google path, which can't
// capture consent at the OAuth step). Writes timestamp, IP, and version,
// and drops an append-only audit event into activity_logs.
router.post('/consent', requireAuth, async (req, res) => {
  try {
    const ip = clientIp(req)
    const { rows } = await pool.query(
      `UPDATE users
          SET popia_consent = TRUE,
              popia_consent_at = NOW(),
              popia_consent_ip = $2,
              popia_consent_version = $3
        WHERE user_id = $1
        RETURNING user_id`,
      [req.userId, ip, POPIA_CONSENT_VERSION])
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' })

    // Append-only audit trail — never overwrites the original consent row
    pool.query(
      `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'popia.consent.granted', 'user', $1, $3)`,
      [req.userId, req.userRole, JSON.stringify({ version: POPIA_CONSENT_VERSION, ip })]
    ).catch(() => {})

    return res.status(200).json({ message: 'Consent recorded.', version: POPIA_CONSENT_VERSION })
  } catch (err) {
    log.error('auth.consent_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// Logout actually REVOKES the session now (TD-5): bumping token_version
// invalidates every JWT previously issued to this user. Best-effort + always
// 200 — the client clears its token regardless, and a missing/invalid token
// just means there's nothing to revoke.
router.post('/logout', async (req, res) => {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      await pool.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = $1', [payload.userId])
      pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.logout', 'user', $1, '{}'::jsonb)`,
        [payload.userId, payload.role]).catch(() => {})
    } catch (err) {
      log.warn('auth.logout_revoke_skipped', { reqId: req.id, msg: err.message })
    }
  }
  res.status(200).json({ message: 'Logged out.' })
})

export default router
