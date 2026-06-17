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
import { captureException } from './observability.js'

import authRouter     from './routes/auth.js'
import tasksRouter    from './routes/tasks.js'
import messagesRouter from './routes/messages.js'
import reviewsRouter  from './routes/reviews.js'
import profileRouter  from './routes/profile.js'
import businessesRouter from './routes/businesses.js'
import locationsRouter from './routes/locations.js'
import disputesRouter from './routes/disputes.js'
import searchRouter from './routes/search.js'
import categoriesRouter from './routes/categories.js'
import templatesRouter from './routes/templates.js'
import adminRouter from './routes/admin.js'
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

// ── Access log — one structured line per request on completion (§7.7) ─────────
app.use((req, res, next) => {
  const start = process.hrtime.bigint()
  // Capture now: Express rewrites req.url to the router-relative path during
  // routing, so reading it in 'finish' would lose the mount prefix.
  const path = req.path
  const method = req.method
  res.on('finish', () => {
    if (path === '/health') return // health checks are noise
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    log.info('request', { reqId: req.id, method, path, status: res.statusCode, ms: Math.round(ms) })
  })
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
app.use('/categories', categoriesRouter)
app.use('/templates', templatesRouter)
app.use('/admin', adminRouter)

// 404 + error handlers
app.use((req, res) => res.status(404).json({ message: 'Not found.' }))
app.use((err, req, res, next) => {
  captureException(err, { reqId: req.id, method: req.method, path: req.path })
  res.status(500).json({ message: 'Internal server error.' })
})

export default app
