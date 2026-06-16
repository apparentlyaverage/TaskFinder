// server/app.js — ReLivR unified backend (MVP), built and exported WITHOUT
// listening so it can be driven in-process by Supertest. The thin entrypoint
// in index.js loads env and calls app.listen().
// One Express app replacing the gateway + auth + tasks + messaging + reviews
// microservices for launch. Code stays modular via routers; split back into
// services post-launch if scale ever demands it.
import express from 'express'
import passport from 'passport'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'node:crypto'
import log from './log.js'

import authRouter     from './routes/auth.js'
import tasksRouter    from './routes/tasks.js'
import messagesRouter from './routes/messages.js'
import reviewsRouter  from './routes/reviews.js'
import profileRouter  from './routes/profile.js'
import businessesRouter from './routes/businesses.js'
import locationsRouter from './routes/locations.js'
import disputesRouter from './routes/disputes.js'
import searchRouter from './routes/search.js'
import { pool } from './db.js'

const app = express()
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// Railway/Vercel sit behind a proxy — needed for secure cookies + correct req.ip
app.set('trust proxy', 1)

// ── Request ID — correlates every log line for a single request (TD-7) ────────
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
})

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
app.use('/auth/forgot-password', rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { message: 'Too many reset requests. Try again later.' },
}))
app.use(rateLimit({
  windowMs: 60 * 1000, max: 120, // general API ceiling
}))

// Passport is used for the Google OAuth handshake only — no sessions.
// Auth state is carried entirely by JWTs, so we initialise passport
// without session support (this avoids the req.session crash).
app.use(passport.initialize())

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
app.use('/profile', profileRouter)
app.use('/businesses', businessesRouter)
app.use('/locations', locationsRouter)
app.use('/disputes', disputesRouter)
app.use('/search', searchRouter)

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: 'Not found.' }))
app.use((err, req, res, next) => {
  log.error('request.unhandled', { reqId: req.id, method: req.method, path: req.path, msg: err.message })
  res.status(500).json({ message: 'Internal server error.' })
})

export default app
