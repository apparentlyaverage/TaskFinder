// server/index.js — TaskFinder unified backend (MVP deployment)
// One Express app replacing the gateway + auth + tasks + messaging + reviews
// microservices for launch. Code stays modular via routers; split back into
// services post-launch if scale ever demands it.
import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import passport from 'passport'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import authRouter     from './routes/auth.js'
import tasksRouter    from './routes/tasks.js'
import messagesRouter from './routes/messages.js'
import reviewsRouter  from './routes/reviews.js'
import { pool } from './db.js'

const app = express()
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const IS_PROD      = process.env.NODE_ENV === 'production'

// Railway/Vercel sit behind a proxy — needed for secure cookies + correct req.ip
app.set('trust proxy', 1)

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet())

// ── CORS — exact origin, never '*' ────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL],
  credentials: true,
}))

app.use(express.json({ limit: '100kb' }))

// ── Rate limits ───────────────────────────────────────────────────────────────
app.use('/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
}))
app.use('/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { message: 'Too many accounts created from this IP.' },
}))
app.use(rateLimit({
  windowMs: 60 * 1000, max: 120, // general API ceiling
}))

// ── Session — OAuth handshake only ────────────────────────────────────────────
// In production frontend (vercel.app) and API (railway.app) are different
// origins, so the OAuth session cookie needs SameSite=None; Secure.
app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   IS_PROD,
    httpOnly: true,
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge:   10 * 60 * 1000,
  },
}))

app.use(passport.initialize())
app.use(passport.session())

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected' })
  } catch {
    res.status(503).json({ status: 'degraded', db: 'unreachable' })
  }
})

app.use('/auth',    authRouter)
app.use('/tasks',   tasksRouter)
app.use('/',        messagesRouter)   // exposes /messages/* and /notifications/*
app.use('/reviews', reviewsRouter)

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: 'Not found.' }))
app.use((err, req, res, next) => {
  console.error('[unhandled]', err.message)
  res.status(500).json({ message: 'Internal server error.' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`[server] TaskFinder API on port ${PORT}`)
  console.log(`[server] Frontend:        ${FRONTEND_URL}`)
  console.log(`[server] Google callback: ${process.env.GOOGLE_CALLBACK_URL}`)
  console.log(`[server] Database:        ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'NOT SET'}`)
})
