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

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   10 * 60 * 1000,
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

// ── Passport session ──────────────────────────────────────────────────────────
passport.serializeUser((user, done) => done(null, user.user_id))

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.email, u.role, u.google_avatar_url,
              up.display_name, up.avatar_url
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`,
      [id]
    )
    done(null, rows[0] || false)
  } catch (err) {
    done(err)
  }
})

// ── Google OAuth Strategy ─────────────────────────────────────────────────────
// NOTE: callbackURL must match EXACTLY what is registered in Google Console
// For local dev: http://localhost:3000/auth/google/callback
// Vite proxies this to http://localhost:3001/auth/google/callback
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
      const avatarUrl   = profile.photos?.[0]?.value?.replace('=s96-c', '=s200-c') // get higher res avatar

      if (!googleEmail) throw new Error('Google account has no email address.')

      // 1. Returning Google user
      let { rows } = await client.query(
        `SELECT u.user_id, u.email, u.role, up.display_name, up.avatar_url
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.google_id = $1`,
        [googleId]
      )
      if (rows.length > 0) {
        // Refresh avatar URL in case Google updated it
        await client.query(
          'UPDATE user_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2',
          [avatarUrl, rows[0].user_id]
        )
        await client.query('COMMIT')
        return done(null, { ...rows[0], google_avatar_url: avatarUrl })
      }

      // 2. Email already exists — link Google to existing account
      ;({ rows } = await client.query(
        `SELECT u.user_id, u.email, u.role, up.display_name, up.avatar_url
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.email = $1`,
        [googleEmail]
      ))
      if (rows.length > 0) {
        await client.query(
          `UPDATE users
           SET google_id = $1, google_email = $2, google_avatar_url = $3,
               is_email_verified = TRUE, updated_at = NOW()
           WHERE user_id = $4`,
          [googleId, googleEmail, avatarUrl, rows[0].user_id]
        )
        await client.query(
          'UPDATE user_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2',
          [avatarUrl, rows[0].user_id]
        )
        await client.query('COMMIT')
        return done(null, { ...rows[0], google_avatar_url: avatarUrl })
      }

      // 3. Brand new user — create account + profile
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

      // Log the new signup
      await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.registered', 'user', $1, $3)`,
        [
          newUser.user_id,
          'earner',
          JSON.stringify({ provider: 'google', email: googleEmail }),
        ]
      ).catch(() => {}) // non-fatal if activity_logs table doesn't exist yet

      return done(null, {
        ...newUser,
        display_name:      displayName,
        avatar_url:        avatarUrl,
        google_avatar_url: avatarUrl,
      })

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

// ── STEP 1: Browser visits this → redirected to Google consent screen ─────────
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
)

// ── STEP 2: Google redirects here after user approves ────────────────────────
// URL must match GOOGLE_CALLBACK_URL exactly
app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/?auth_error=google_failed`,
    session: true,
  }),
  async (req, res) => {
    try {
      const user  = req.user
      const token = issueToken(user)

      // Fetch display_name fresh from DB to ensure we have it
      const { rows } = await pool.query(
        'SELECT display_name, avatar_url FROM user_profiles WHERE user_id = $1',
        [user.user_id]
      )
      const displayName = rows[0]?.display_name || user.display_name || user.email?.split('@')[0] || 'Google User'
      const avatarUrl   = rows[0]?.avatar_url   || user.google_avatar_url || ''

      // Log the sign-in
      await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.login', 'user', $1, $3)`,
        [
          user.user_id,
          user.role,
          JSON.stringify({ provider: 'google' }),
        ]
      ).catch(() => {})

      // Redirect to /oauth-callback on the frontend with all user data as query params
      // Vite serves this page on port 3000
      const params = new URLSearchParams({
        token,
        userId:      user.user_id,
        email:       user.email,
        role:        user.role,
        displayName,
        avatarUrl,
      })

      // Redirect to frontend oauth-callback page
      res.redirect(`${FRONTEND_URL}/oauth-callback?${params.toString()}`)

    } catch (err) {
      console.error('[google callback]', err.message)
      res.redirect(`${FRONTEND_URL}/?auth_error=callback_failed`)
    }
  }
)

// ── Local register ────────────────────────────────────────────────────────────
app.post('/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['creator', 'earner']),
    body('displayName').optional().trim(),
  ],
  handleValidation,
  async (req, res) => {
    const { email, password, role = 'earner', displayName } = req.body
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const existing = await client.query(
        'SELECT user_id FROM users WHERE email = $1', [email]
      )
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

      // Log registration
      await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.registered', 'user', $1, $3)`,
        [newUser.user_id, role, JSON.stringify({ provider: 'email', email })]
      ).catch(() => {})

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
        `SELECT u.user_id, u.email, u.role, u.password_hash, u.google_id,
                up.display_name
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.email = $1`,
        [email]
      )
      if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' })

      const user = rows[0]
      if (!user.password_hash) {
        return res.status(401).json({
          message: 'This account uses Google Sign-In. Please click the "Sign in with Google" button.',
        })
      }

      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) return res.status(401).json({ message: 'Invalid credentials.' })

      // Log login
      await pool.query(
        `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'user.login', 'user', $1, $3)`,
        [user.user_id, user.role, JSON.stringify({ provider: 'email' })]
      ).catch(() => {})

      return res.status(200).json({
        token: issueToken(user),
        user: {
          userId:      user.user_id,
          email:       user.email,
          role:        user.role,
          displayName: user.display_name || email.split('@')[0],
        },
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
      `SELECT u.user_id, u.email, u.role, u.google_id, u.google_avatar_url,
              up.display_name, up.avg_rating, up.avatar_url, up.skills, up.bio
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
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
app.listen(PORT, () => {
  console.log(`[auth] Running on port ${PORT}`)
  console.log(`[auth] Google callback URL: ${process.env.GOOGLE_CALLBACK_URL}`)
  console.log(`[auth] Frontend URL: ${process.env.FRONTEND_URL}`)
  console.log(`[auth] Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost'}`)
})
