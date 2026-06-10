// services/auth/index.js
import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { body, validationResult } from 'express-validator'

const { Pool } = pg
const app  = express()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const SALT_ROUNDS  = 12
const JWT_SECRET   = process.env.JWT_SECRET
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN || '7d'
const FRONTEND_URL = process.env.FRONTEND_URL   || 'http://localhost:3000'

// ── Session — only needed during the OAuth handshake ─────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   10 * 60 * 1000, // 10 minutes — just long enough for OAuth round trip
  },
}))

app.use(express.json())
app.use(passport.initialize())
app.use(passport.session())

// ── Helpers ───────────────────────────────────────────────────────────────────
function issueToken(user) {
  return jwt.sign(
    { userId: user.user_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )
}

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// ── Passport serialise/deserialise ────────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user.user_id))

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT user_id, email, role FROM users WHERE user_id = $1', [id])
    done(null, rows[0] || false)
  } catch (err) {
    done(err)
  }
})

// ── Google OAuth Strategy ─────────────────────────────────────────────────────
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
      const avatarUrl   = profile.photos?.[0]?.value

      if (!googleEmail) throw new Error('Google did not provide an email address.')

      // 1. Existing Google user — returning sign-in
      let { rows } = await client.query(
        'SELECT user_id, email, role FROM users WHERE google_id = $1', [googleId]
      )
      if (rows.length > 0) {
        await client.query(
          'UPDATE user_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2',
          [avatarUrl, rows[0].user_id]
        )
        await client.query('COMMIT')
        return done(null, rows[0])
      }

      // 2. Existing email user — link Google to their account
      ;({ rows } = await client.query(
        'SELECT user_id, email, role FROM users WHERE email = $1', [googleEmail]
      ))
      if (rows.length > 0) {
        await client.query(
          'UPDATE users SET google_id = $1, google_avatar_url = $2, is_email_verified = TRUE, updated_at = NOW() WHERE user_id = $3',
          [googleId, avatarUrl, rows[0].user_id]
        )
        await client.query(
          'UPDATE user_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2',
          [avatarUrl, rows[0].user_id]
        )
        await client.query('COMMIT')
        return done(null, rows[0])
      }

      // 3. Brand new user
      ;({ rows } = await client.query(
        `INSERT INTO users
           (email, role, google_id, google_email, google_avatar_url,
            is_email_verified, popia_consent, popia_consent_at)
         VALUES ($1, 'earner', $2, $3, $4, TRUE, TRUE, NOW())
         RETURNING user_id, email, role`,
        [googleEmail, googleId, googleEmail, avatarUrl]
      ))
      const newUser = rows[0]

      await client.query(
        'INSERT INTO user_profiles (user_id, display_name, avatar_url) VALUES ($1, $2, $3)',
        [newUser.user_id, displayName, avatarUrl]
      )

      await client.query('COMMIT')
      return done(null, newUser)

    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[google strategy]', err.message)
      return done(err)
    } finally {
      client.release()
    }
  }
))

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth' }))

// ── Google OAuth routes ───────────────────────────────────────────────────────

// Step 1 — browser is sent to Google consent screen
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
)

// Step 2 — Google redirects back here with a code
app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/?auth_error=google_failed`,
    session: true,
  }),
  (req, res) => {
    const user  = req.user
    const token = issueToken(user)

    // Send token + user info back to the frontend as query params
    // The frontend /oauth-callback page reads these and logs the user in
    const params = new URLSearchParams({
      token,
      userId:      user.user_id,
      email:       user.email,
      role:        user.role,
      displayName: user.display_name || user.email.split('@')[0],
    })

    res.redirect(`${FRONTEND_URL}/oauth-callback?${params.toString()}`)
  }
)

// ── Local register ────────────────────────────────────────────────────────────
app.post('/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['creator', 'earner']),
  ],
  handleValidation,
  async (req, res) => {
    const { email, password, role = 'earner', displayName } = req.body
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
        `INSERT INTO users (email, password_hash, role, popia_consent, popia_consent_at)
         VALUES ($1, $2, $3, TRUE, NOW())
         RETURNING user_id, email, role`,
        [email, hash, role]
      )
      const newUser = rows[0]
      await client.query(
        'INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)',
        [newUser.user_id, displayName || email.split('@')[0]]
      )
      await client.query('COMMIT')
      return res.status(201).json({
        token: issueToken(newUser),
        user:  { userId: newUser.user_id, email: newUser.email, role: newUser.role },
      })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[register]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// ── Local login ───────────────────────────────────────────────────────────────
app.post('/auth/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  handleValidation,
  async (req, res) => {
    const { email, password } = req.body
    try {
      const { rows } = await pool.query(
        'SELECT user_id, email, role, password_hash, google_id FROM users WHERE email = $1',
        [email]
      )
      if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' })
      const user = rows[0]
      if (!user.password_hash) {
        return res.status(401).json({ message: 'This account uses Google Sign-In. Please use the Google button.' })
      }
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) return res.status(401).json({ message: 'Invalid credentials.' })
      return res.status(200).json({
        token: issueToken(user),
        user:  { userId: user.user_id, email: user.email, role: user.role },
      })
    } catch (err) {
      console.error('[login]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── Get current user ──────────────────────────────────────────────────────────
app.get('/auth/me', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' })
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.email, u.role, u.google_id,
              up.display_name, up.avg_rating, up.avatar_url
       FROM users u
       JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`,
      [userId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' })
    return res.status(200).json({ user: rows[0] })
  } catch (err) {
    console.error('[me]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── Logout ────────────────────────────────────────────────────────────────────
app.post('/auth/logout', (req, res) => {
  req.logout?.(() => {})
  req.session?.destroy?.(() => {})
  res.status(200).json({ message: 'Logged out.' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`[auth] Running on port ${PORT}`))
