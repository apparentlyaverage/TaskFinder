// server/routes/beta.js — public beta endpoints (§6.18): feedback + launch waitlist.
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { pool } from '../db.js'
import { emailWaitlistConfirmation } from '../emails.js'
import { requireHuman } from '../turnstile.js'
import log from '../log.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// Best-effort: if a Bearer token is present, attribute the submission.
function maybeUserId(req) {
  const h = req.headers.authorization || ''
  const t = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!t) return null
  try { return jwt.verify(t, process.env.JWT_SECRET).userId } catch { return null }
}

// POST /feedback — anyone can send beta feedback. Turnstile-guarded when
// configured (these are the only unauthenticated write endpoints on the site).
router.post('/feedback',
  requireHuman,
  [
    body('message').trim().notEmpty().isLength({ min: 3, max: 4000 }),
    body('name').optional({ nullable: true }).trim().isLength({ max: 120 }),
    body('email').optional({ nullable: true }).trim().isEmail().normalizeEmail(),
  ],
  check,
  async (req, res) => {
    const { message, name = null, email = null } = req.body
    try {
      await pool.query(
        'INSERT INTO feedback (name, email, message, user_id) VALUES ($1,$2,$3,$4)',
        [name, email, message, maybeUserId(req)])
      return res.status(201).json({ message: 'Thanks — your feedback means a lot during our beta.' })
    } catch (err) {
      log.error('beta.feedback_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// POST /waitlist — join the launch-reminder list (idempotent on email).
router.post('/waitlist',
  requireHuman,
  [body('email').trim().isEmail().normalizeEmail()],
  check,
  async (req, res) => {
    try {
      await pool.query(
        `INSERT INTO waitlist (email, want_reminder) VALUES ($1, TRUE)
         ON CONFLICT (email) DO UPDATE SET want_reminder = TRUE`,
        [req.body.email])
      emailWaitlistConfirmation(req.body.email).catch(() => {})
      return res.status(201).json({ message: "You're on the list — we'll email you when ReLivR launches." })
    } catch (err) {
      log.error('beta.waitlist_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
