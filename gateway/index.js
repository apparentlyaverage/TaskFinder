// gateway/index.js
import 'dotenv/config'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import helmet from 'helmet'
import morgan from 'morgan'
import jwt from 'jsonwebtoken'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import { createClient } from 'redis'
import routes from './routes.js'
import { limiterConfigs } from './rateLimits.js'

const app = express()
const JWT_SECRET = process.env.JWT_SECRET
const REDIS_URL  = process.env.REDIS_URL || 'redis://localhost:6379'

const redisClient = createClient({ url: REDIS_URL })
redisClient.connect().catch(err => console.error('[gateway] Redis connection failed:', err.message))

app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
}))

morgan.token('user-id', (req) => req.user?.userId || 'anonymous')
app.use(morgan(':method :url :status :response-time ms — user=:user-id', {
  skip: (req) => req.url === '/health',
}))

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

function buildLimiter(config) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: { message: config.message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
  })
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' })
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({
      message: err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.',
    })
  }
}

function buildProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.user) {
          proxyReq.setHeader('X-User-Id',    req.user.userId)
          proxyReq.setHeader('X-User-Role',  req.user.role)
          proxyReq.setHeader('X-User-Email', req.user.email || '')
        }
        proxyReq.removeHeader('Authorization')
      },
      error: (err, req, res) => {
        console.error('[gateway] Proxy error:', err.message)
        res.status(502).json({ message: 'Service temporarily unavailable.' })
      },
    },
  })
}

// Routes
app.use('/auth/register', buildLimiter(limiterConfigs.register), buildProxy(routes.auth.target))
app.use('/auth/login',    buildLimiter(limiterConfigs.login),    buildProxy(routes.auth.target))
app.use('/auth',          requireAuth,                           buildProxy(routes.auth.target))
app.use('/tasks',         buildLimiter(limiterConfigs.standard), requireAuth, buildProxy(routes.tasks.target))
app.use('/payments/webhook',                                     buildProxy(routes.payments.target))
app.use('/payments',      buildLimiter(limiterConfigs.payments), requireAuth, buildProxy(routes.payments.target))
app.use('/messages',      buildLimiter(limiterConfigs.messaging), requireAuth, buildProxy(routes.messaging.target))
app.use('/notifications', buildLimiter(limiterConfigs.standard), requireAuth, buildProxy(routes.messaging.target))
app.use('/matching',      buildLimiter(limiterConfigs.standard), requireAuth, buildProxy(routes.matching.target))
app.use('/reviews',       buildLimiter(limiterConfigs.standard), requireAuth, buildProxy(routes.reviews.target))
app.use('/disputes',      buildLimiter(limiterConfigs.standard), requireAuth, buildProxy(routes.disputes.target))

app.use((err, req, res, next) => {
  console.error('[gateway] Unhandled error:', err.message)
  res.status(500).json({ message: 'An unexpected error occurred.' })
})

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found.` })
})

const PORT = process.env.GATEWAY_PORT || 8080
app.listen(PORT, () => console.log(`[gateway] Running on port ${PORT}`))
