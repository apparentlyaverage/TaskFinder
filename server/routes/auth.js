// server/routes/auth.js — local auth + Google OAuth (merged from services/auth)
import { Router } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { body, validationResult } from 'express-validator'
import { pool } from '../db.js'
import { sendEmail, EMAIL_FROM_SUPPORT, SUPPORT_REPLY_TO } from '../email.js'
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

// ── Single-use email tokens (password reset / email verify) ───────────────────
const RESET_TTL_MS  = 60 * 60 * 1000          // 1 hour
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000     // 24 hours
const hashToken = raw => crypto.createHash('sha256').update(raw).digest('hex')

// Returns the RAW token (emailed to the user); only its hash is stored.
async function issueAuthToken(userId, purpose, ttlMs) {
  const raw = crypto.randomBytes(32).toString('hex')
  await pool.query(
    `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, hashToken(raw), purpose, new Date(Date.now() + ttlMs)])
  return raw
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

      // Best-effort email verification — must never block registration.
      issueAuthToken(newUser.user_id, 'email_verify', VERIFY_TTL_MS)
        .then(raw => sendEmail({
          to: email,
          subject: 'Verify your ReLivR email',
          text: `Welcome to ReLivR! Verify your email: ${FRONTEND_URL}/verify-email?token=${raw}`,
          from: EMAIL_FROM_SUPPORT,
          replyTo: SUPPORT_REPLY_TO,
        }))
        .catch(() => {})

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
        `SELECT u.user_id, u.email, u.role, u.password_hash, u.token_version,
                u.failed_login_attempts, u.locked_until, u.deleted_at, u.suspended_at,
                up.display_name, up.avatar_url
         FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.email = $1`, [email])
      if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' })
      const user = rows[0]
      // Closed accounts can't sign in (and we don't reveal that they existed).
      if (user.deleted_at) return res.status(401).json({ message: 'Invalid credentials.' })
      if (user.suspended_at) return res.status(403).json({ message: 'This account has been suspended. Contact support.' })
      // Per-account lockout (independent of the per-IP rate limit).
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(423).json({ message: 'Account temporarily locked after repeated failed logins. Please try again later.' })
      }
      if (!user.password_hash) {
        return res.status(401).json({ message: 'This account uses Google Sign-In. Please click the "Sign in with Google" button.' })
      }
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) {
        const attempts = (user.failed_login_attempts || 0) + 1
        // Progressive backoff once over the threshold: 15m, 30m, 60m, … capped 24h.
        const lockMinutes = attempts >= 5 ? Math.min(15 * 2 ** (attempts - 5), 1440) : 0
        const lockedUntil = lockMinutes ? new Date(Date.now() + lockMinutes * 60000) : null
        await pool.query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE user_id = $3',
          [attempts, lockedUntil, user.user_id]).catch(() => {})
        if (lockedUntil) {
          return res.status(423).json({ message: `Too many failed attempts — account locked for ${lockMinutes} minutes.` })
        }
        return res.status(401).json({ message: 'Invalid credentials.' })
      }
      // Success — clear any failure state.
      if (user.failed_login_attempts > 0 || user.locked_until) {
        pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = $1',
          [user.user_id]).catch(() => {})
      }

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
              u.popia_consent, u.token_version, u.beta_founder,
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

// POST /auth/logout-all — explicit "sign out of all devices": bump token_version
// so every JWT ever issued to this user stops working immediately.
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE user_id = $1', [req.userId])
    log.info('auth.logout_all', { reqId: req.id, userId: req.userId })
    return res.status(200).json({ message: 'Signed out of all devices.' })
  } catch (err) {
    log.error('auth.logout_all_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /auth/forgot-password — issue a reset link. Always returns a generic
// 200 so the endpoint can't be used to enumerate registered emails.
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  check,
  async (req, res) => {
    const { email } = req.body
    try {
      const { rows } = await pool.query(
        'SELECT user_id, password_hash FROM users WHERE email = $1', [email])
      const user = rows[0]
      // Only email-password accounts can reset (Google-only accounts have no password).
      if (user && user.password_hash) {
        const raw = await issueAuthToken(user.user_id, 'password_reset', RESET_TTL_MS)
        await sendEmail({
          to: email,
          subject: 'Reset your ReLivR password',
          text: `Reset your password using this link (valid 1 hour): ${FRONTEND_URL}/reset-password?token=${raw}`,
          from: EMAIL_FROM_SUPPORT,
          replyTo: SUPPORT_REPLY_TO,
        })
      }
      return res.status(200).json({ message: 'If that email is registered, a reset link is on its way.' })
    } catch (err) {
      log.error('auth.forgot_password_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// POST /auth/reset-password — consume a reset token, set the new password, and
// revoke all existing sessions (token_version bump).
router.post('/reset-password',
  [body('token').notEmpty(), body('newPassword').isLength({ min: 8 })],
  check,
  async (req, res) => {
    const { token, newPassword } = req.body
    try {
      const { rows } = await pool.query(
        `SELECT token_id, user_id FROM auth_tokens
         WHERE token_hash = $1 AND purpose = 'password_reset'
           AND used_at IS NULL AND expires_at > NOW()`,
        [hashToken(token)])
      if (rows.length === 0) {
        return res.status(400).json({ message: 'This reset link is invalid or has expired.' })
      }
      const { token_id, user_id } = rows[0]
      const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE user_id = $2',
          [newHash, user_id])
        // Burn this token and any other outstanding reset tokens for the user.
        await client.query(
          "UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = 'password_reset' AND used_at IS NULL",
          [user_id])
        await client.query('COMMIT')
      } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }

      log.info('auth.password_reset', { reqId: req.id, userId: user_id })
      return res.status(200).json({ message: 'Password reset. Please sign in with your new password.' })
    } catch (err) {
      log.error('auth.reset_password_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// POST /auth/verify-email — consume an email-verification token.
router.post('/verify-email',
  [body('token').notEmpty()],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT token_id, user_id FROM auth_tokens
         WHERE token_hash = $1 AND purpose = 'email_verify'
           AND used_at IS NULL AND expires_at > NOW()`,
        [hashToken(req.body.token)])
      if (rows.length === 0) {
        return res.status(400).json({ message: 'This verification link is invalid or has expired.' })
      }
      await pool.query('UPDATE users SET is_email_verified = TRUE WHERE user_id = $1', [rows[0].user_id])
      await pool.query('UPDATE auth_tokens SET used_at = NOW() WHERE token_id = $1', [rows[0].token_id])
      return res.status(200).json({ message: 'Email verified.' })
    } catch (err) {
      log.error('auth.verify_email_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
