// services/auth/index.js
import 'dotenv/config'
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { body, validationResult } from 'express-validator'

const { Pool } = pg
const app = express()
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const SALT_ROUNDS = 12
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

function issueToken(user) {
  return jwt.sign({ userId: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /auth/register
app.post('/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').optional().isIn(['creator', 'earner']),
  ],
  handleValidation,
  async (req, res) => {
    const { email, password, role = 'earner' } = req.body
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email])
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Email already registered.' })
      }
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
      const { rows } = await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING user_id, email, role',
        [email, password_hash, role]
      )
      const newUser = rows[0]
      await client.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [newUser.user_id])
      await client.query('COMMIT')
      const token = issueToken(newUser)
      return res.status(201).json({ token, user: { userId: newUser.user_id, email: newUser.email, role: newUser.role } })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[register]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// POST /auth/login
app.post('/auth/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  handleValidation,
  async (req, res) => {
    const { email, password } = req.body
    try {
      const { rows } = await pool.query(
        'SELECT user_id, email, role, password_hash FROM users WHERE email = $1', [email]
      )
      if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' })
      const user = rows[0]
      const isMatch = await bcrypt.compare(password, user.password_hash)
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' })
      const token = issueToken(user)
      return res.status(200).json({ token, user: { userId: user.user_id, email: user.email, role: user.role } })
    } catch (err) {
      console.error('[login]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /auth/me
app.get('/auth/me', async (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) return res.status(401).json({ message: 'Unauthorized.' })
  try {
    const { rows } = await pool.query(
      'SELECT u.user_id, u.email, u.role, up.display_name, up.avg_rating FROM users u JOIN user_profiles up ON u.user_id = up.user_id WHERE u.user_id = $1',
      [userId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' })
    return res.status(200).json({ user: rows[0] })
  } catch (err) {
    console.error('[me]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Auth service running on port ${PORT}`))