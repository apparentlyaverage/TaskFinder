# ============================================================
# TaskFinder Platform — Full Backend Setup Script
# Run from: C:\Users\tmkwa\OneDrive\Documents\taskfinder-platform
# Usage: .\setup_backend.ps1
# ============================================================

$root = "C:\Users\tmkwa\OneDrive\Documents\taskfinder-platform"
Set-Location $root
Write-Host "Working in: $root" -ForegroundColor Cyan

# ── Helper to write files cleanly ────────────────────────────────────────────
function Write-File($path, $content) {
    $dir = Split-Path $path
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText("$root\$path", $content, [System.Text.Encoding]::UTF8)
    Write-Host "  Created: $path" -ForegroundColor Green
}

Write-Host ""
Write-Host "Creating gateway files..." -ForegroundColor Yellow

# ============================================================
# GATEWAY/ROUTES.JS
# ============================================================
Write-File "gateway\routes.js" @'
// gateway/routes.js
module.exports = {
  auth: {
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    description: 'Authentication & user management',
  },
  tasks: {
    target: process.env.TASKS_SERVICE_URL || 'http://localhost:3002',
    description: 'Task engine & bidding',
  },
  payments: {
    target: process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3003',
    description: 'Stripe escrow & transfers',
  },
  messaging: {
    target: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    description: 'Direct messages & notifications',
  },
  matching: {
    target: process.env.MATCHING_SERVICE_URL || 'http://localhost:3005',
    description: 'Skill-based matching engine',
  },
  reviews: {
    target: process.env.REVIEWS_SERVICE_URL || 'http://localhost:3006',
    description: 'Reviews & ratings',
  },
  disputes: {
    target: process.env.DISPUTES_SERVICE_URL || 'http://localhost:3007',
    description: 'Dispute resolution',
  },
}
'@

# ============================================================
# GATEWAY/RATELIMITS.JS
# ============================================================
Write-File "gateway\rateLimits.js" @'
// gateway/rateLimits.js
module.exports = {
  limiterConfigs: {
    login: {
      prefix: 'login',
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    },
    register: {
      prefix: 'register',
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: 'Too many accounts created. Please try again later.',
    },
    payments: {
      prefix: 'payments',
      windowMs: 60 * 1000,
      max: 20,
      message: 'Too many payment requests. Please slow down.',
    },
    messaging: {
      prefix: 'messaging',
      windowMs: 60 * 1000,
      max: 60,
      message: 'Sending too many messages. Please wait a moment.',
    },
    standard: {
      prefix: 'standard',
      windowMs: 60 * 1000,
      max: 120,
      message: 'Too many requests. Please slow down.',
    },
  },
}
'@

# ============================================================
# GATEWAY/INDEX.JS
# ============================================================
Write-File "gateway\index.js" @'
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
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const routes = require('./routes.js')
const { limiterConfigs } = require('./rateLimits.js')

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
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required.' })
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ message: err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.' })
  }
}

function buildProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.user) {
          proxyReq.setHeader('X-User-Id', req.user.userId)
          proxyReq.setHeader('X-User-Role', req.user.role)
          proxyReq.setHeader('X-User-Email', req.user.email || '')
        }
        proxyReq.removeHeader('Authorization')
      },
      error: (err, req, res) => {
        console.error(`[gateway] Proxy error:`, err.message)
        res.status(502).json({ message: 'Service temporarily unavailable.' })
      },
    },
  })
}

app.use('/auth/register', buildLimiter(limiterConfigs.register), buildProxy(routes.auth.target))
app.use('/auth/login',    buildLimiter(limiterConfigs.login),    buildProxy(routes.auth.target))
app.use('/tasks',         buildLimiter(limiterConfigs.standard), requireAuth, buildProxy(routes.tasks.target))
app.use('/payments/webhook', buildProxy(routes.payments.target))
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
'@

Write-Host ""
Write-Host "Creating service files..." -ForegroundColor Yellow

# ============================================================
# SERVICES/AUTH/INDEX.JS
# ============================================================
Write-File "services\auth\index.js" @'
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
'@

# ============================================================
# SERVICES/TASKS/INDEX.JS
# ============================================================
Write-File "services\tasks\index.js" @'
// services/tasks/index.js
import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { body, param, validationResult } from 'express-validator'
import amqplib from 'amqplib'

const { Pool } = pg
const app = express()
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let channel = null

async function connectMQ() {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL)
    channel = await conn.createChannel()
    await channel.assertExchange('taskfinder.events', 'topic', { durable: true })
    console.log('[tasks] RabbitMQ connected')
  } catch (err) {
    console.error('[tasks] RabbitMQ connection failed:', err.message)
    setTimeout(connectMQ, 5000)
  }
}

function publish(key, payload) {
  if (!channel) return
  channel.publish('taskfinder.events', key, Buffer.from(JSON.stringify(payload)), { persistent: true })
}

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /tasks
app.post('/tasks',
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').trim().notEmpty(),
    body('budget').isFloat({ gt: 0 }),
    body('deadline').isISO8601(),
    body('skill_tags').optional().isArray(),
  ],
  handleValidation,
  async (req, res) => {
    const { title, description, budget, deadline, skill_tags = [] } = req.body
    const creatorId = req.headers['x-user-id']
    if (new Date(deadline) <= new Date()) return res.status(400).json({ message: 'Deadline must be in the future.' })
    try {
      const { rows } = await pool.query(
        'INSERT INTO tasks (creator_id, title, description, budget, deadline, skill_tags) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [creatorId, title, description, budget, deadline, skill_tags]
      )
      publish('task.created', { taskId: rows[0].task_id, title, skillTags: skill_tags, creatorId })
      return res.status(201).json({ task: rows[0] })
    } catch (err) {
      console.error('[POST /tasks]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /tasks
app.get('/tasks', async (req, res) => {
  const { skill, limit = 20, offset = 0 } = req.query
  try {
    let query, params
    if (skill) {
      query = "SELECT * FROM tasks WHERE status = 'open' AND skill_tags @> ARRAY[$1]::TEXT[] ORDER BY created_at DESC LIMIT $2 OFFSET $3"
      params = [skill, limit, offset]
    } else {
      query = "SELECT * FROM tasks WHERE status = 'open' ORDER BY created_at DESC LIMIT $1 OFFSET $2"
      params = [limit, offset]
    }
    const { rows } = await pool.query(query, params)
    return res.status(200).json({ tasks: rows, count: rows.length })
  } catch (err) {
    console.error('[GET /tasks]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /tasks/:taskId
app.get('/tasks/:taskId', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  try {
    const taskResult = await pool.query('SELECT * FROM tasks WHERE task_id = $1', [taskId])
    if (taskResult.rows.length === 0) return res.status(404).json({ message: 'Task not found.' })
    const bidsResult = await pool.query(
      'SELECT b.*, up.display_name, up.avg_rating FROM bids b JOIN user_profiles up ON b.bidder_id = up.user_id WHERE b.task_id = $1 ORDER BY b.amount ASC',
      [taskId]
    )
    return res.status(200).json({ task: taskResult.rows[0], bids: bidsResult.rows })
  } catch (err) {
    console.error('[GET /tasks/:taskId]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /tasks/:taskId/bids
app.post('/tasks/:taskId/bids',
  [param('taskId').isUUID(), body('amount').isFloat({ gt: 0 }), body('pitch').trim().notEmpty()],
  handleValidation,
  async (req, res) => {
    const { taskId } = req.params
    const { amount, pitch } = req.body
    const bidderId = req.headers['x-user-id']
    try {
      const taskResult = await pool.query('SELECT task_id, creator_id, status FROM tasks WHERE task_id = $1', [taskId])
      if (taskResult.rows.length === 0) return res.status(404).json({ message: 'Task not found.' })
      if (taskResult.rows[0].status !== 'open') return res.status(409).json({ message: 'Task is no longer accepting bids.' })
      if (taskResult.rows[0].creator_id === bidderId) return res.status(403).json({ message: 'You cannot bid on your own task.' })
      const { rows } = await pool.query(
        'INSERT INTO bids (task_id, bidder_id, amount, pitch) VALUES ($1, $2, $3, $4) RETURNING *',
        [taskId, bidderId, amount, pitch]
      )
      publish('bid.submitted', { taskId, creatorId: taskResult.rows[0].creator_id, bidderId, amount, taskTitle: '' })
      return res.status(201).json({ bid: rows[0] })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'You have already bid on this task.' })
      console.error('[POST bids]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /tasks/:taskId/bids/:bidId/accept
app.patch('/tasks/:taskId/bids/:bidId/accept',
  [param('taskId').isUUID(), param('bidId').isUUID()],
  handleValidation,
  async (req, res) => {
    const { taskId, bidId } = req.params
    const creatorId = req.headers['x-user-id']
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskResult = await client.query('SELECT * FROM tasks WHERE task_id = $1 AND creator_id = $2 FOR UPDATE', [taskId, creatorId])
      if (taskResult.rows.length === 0 || taskResult.rows[0].status !== 'open') {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Task not found or not open.' })
      }
      const bidResult = await client.query('SELECT * FROM bids WHERE bid_id = $1 AND task_id = $2', [bidId, taskId])
      if (bidResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Bid not found.' }) }
      const winningBid = bidResult.rows[0]
      await client.query("UPDATE bids SET status = 'accepted' WHERE bid_id = $1", [bidId])
      await client.query("UPDATE bids SET status = 'rejected' WHERE task_id = $1 AND bid_id != $2", [taskId, bidId])
      await client.query("UPDATE tasks SET status = 'in_progress', assigned_to = $1 WHERE task_id = $2", [winningBid.bidder_id, taskId])
      await client.query('COMMIT')
      publish('bid.accepted', { taskId, earnerId: winningBid.bidder_id, taskTitle: taskResult.rows[0].title })
      return res.status(200).json({ message: 'Bid accepted.', assignedTo: winningBid.bidder_id })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[accept bid]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

const PORT = process.env.PORT || 3002
app.listen(PORT, async () => {
  await connectMQ()
  console.log(`Tasks service running on port ${PORT}`)
})
'@

# ============================================================
# SERVICES/MESSAGING/EVENTBUS.JS
# ============================================================
Write-File "services\messaging\eventBus.js" @'
// services/messaging/eventBus.js
import amqplib from 'amqplib'

const EXCHANGE = 'taskfinder.events'
let channel = null

export async function connect() {
  const connection = await amqplib.connect(process.env.RABBITMQ_URL)
  channel = await connection.createChannel()
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
  console.log('[eventBus] Connected to RabbitMQ')
  connection.on('close', () => { console.warn('[eventBus] Reconnecting...'); setTimeout(connect, 5000) })
  return channel
}

export function publish(routingKey, payload) {
  if (!channel) throw new Error('Event bus not connected.')
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true })
  console.log(`[eventBus] Published: ${routingKey}`)
}

export async function subscribe(routingPattern, queueName, handler) {
  if (!channel) throw new Error('Event bus not connected.')
  await channel.assertQueue(queueName, { durable: true })
  await channel.bindQueue(queueName, EXCHANGE, routingPattern)
  channel.prefetch(1)
  channel.consume(queueName, async (msg) => {
    if (!msg) return
    try {
      const payload = JSON.parse(msg.content.toString())
      await handler(payload)
      channel.ack(msg)
    } catch (err) {
      console.error(`[eventBus] Handler error on ${routingPattern}:`, err.message)
      channel.nack(msg, false, true)
    }
  })
  console.log(`[eventBus] Subscribed: ${routingPattern} -> ${queueName}`)
}
'@

# ============================================================
# SERVICES/MESSAGING/INDEX.JS
# ============================================================
Write-File "services\messaging\index.js" @'
// services/messaging/index.js
import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { body, param, validationResult } from 'express-validator'
import { connect as connectMQ, subscribe, publish } from './eventBus.js'

const { Pool } = pg
const app = express()
const server = http.createServer(app)
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const JWT_SECRET = process.env.JWT_SECRET
const onlineUsers = new Map()

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] },
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Authentication required.'))
  try { socket.user = jwt.verify(token, JWT_SECRET); next() }
  catch { next(new Error('Invalid token.')) }
})

io.on('connection', (socket) => {
  onlineUsers.set(socket.user.userId, socket.id)
  socket.on('disconnect', () => onlineUsers.delete(socket.user.userId))
})

function pushToUser(userId, event, data) {
  const socketId = onlineUsers.get(userId)
  if (socketId) io.to(socketId).emit(event, data)
}

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /messages
app.post('/messages',
  [body('receiver_id').isUUID(), body('content').trim().notEmpty().isLength({ max: 2000 })],
  handleValidation,
  async (req, res) => {
    const { receiver_id, task_id = null, content } = req.body
    const sender_id = req.headers['x-user-id']
    if (sender_id === receiver_id) return res.status(400).json({ message: 'Cannot message yourself.' })
    try {
      const { rows } = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, task_id, content) VALUES ($1, $2, $3, $4) RETURNING *',
        [sender_id, receiver_id, task_id, content]
      )
      pushToUser(receiver_id, 'message.new', rows[0])
      return res.status(201).json({ message: rows[0] })
    } catch (err) {
      console.error('[POST /messages]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /messages/:userId
app.get('/messages/:userId', [param('userId').isUUID()], handleValidation, async (req, res) => {
  const me = req.headers['x-user-id']
  const them = req.params.userId
  const { limit = 50 } = req.query
  try {
    const { rows } = await pool.query(
      'SELECT * FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1) ORDER BY created_at DESC LIMIT $3',
      [me, them, limit]
    )
    await pool.query('UPDATE messages SET is_read=TRUE WHERE receiver_id=$1 AND sender_id=$2 AND is_read=FALSE', [me, them])
    return res.status(200).json({ messages: rows.reverse() })
  } catch (err) {
    console.error('[GET /messages]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /notifications
app.get('/notifications', async (req, res) => {
  const userId = req.headers['x-user-id']
  const { unread_only = false, limit = 20 } = req.query
  try {
    const query = unread_only === 'true'
      ? 'SELECT * FROM notifications WHERE user_id=$1 AND is_read=FALSE ORDER BY created_at DESC LIMIT $2'
      : 'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2'
    const { rows } = await pool.query(query, [userId, limit])
    const count = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE', [userId])
    return res.status(200).json({ notifications: rows, unread_count: parseInt(count.rows[0].count) })
  } catch (err) {
    console.error('[GET /notifications]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// PATCH /notifications/read
app.patch('/notifications/read', async (req, res) => {
  const userId = req.headers['x-user-id']
  try {
    await pool.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE', [userId])
    return res.status(200).json({ message: 'All notifications marked as read.' })
  } catch (err) {
    console.error('[PATCH /notifications/read]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

async function createNotification({ userId, type, title, body, referenceId }) {
  const { rows } = await pool.query(
    'INSERT INTO notifications (user_id, type, title, body, reference_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [userId, type, title, body, referenceId]
  )
  pushToUser(userId, 'notification.new', rows[0])
}

async function startConsumers() {
  await connectMQ()

  await subscribe('bid.submitted', 'notif.bid.submitted', async (p) => {
    await createNotification({ userId: p.creatorId, type: 'bid.submitted', title: 'New bid on your task', body: `Someone bid $${p.amount} on your task.`, referenceId: p.taskId })
  })

  await subscribe('bid.accepted', 'notif.bid.accepted', async (p) => {
    await createNotification({ userId: p.earnerId, type: 'bid.accepted', title: 'Your bid was accepted!', body: `Your bid on "${p.taskTitle}" was accepted.`, referenceId: p.taskId })
  })

  await subscribe('payment.released', 'notif.payment.released', async (p) => {
    await createNotification({ userId: p.earnerId, type: 'payment.released', title: 'Payment released!', body: `$${p.amount} has been transferred to your account.`, referenceId: p.taskId })
  })

  await subscribe('payment.refunded', 'notif.payment.refunded', async (p) => {
    await createNotification({ userId: p.creatorId, type: 'payment.refunded', title: 'Refund processed', body: `Your payment for "${p.taskTitle}" has been refunded.`, referenceId: p.taskId })
  })
}

const PORT = process.env.PORT || 3004
server.listen(PORT, async () => {
  await startConsumers()
  console.log(`Messaging service running on port ${PORT}`)
})
'@

# ============================================================
# SERVICES/PAYMENTS/INDEX.JS
# ============================================================
Write-File "services\payments\index.js" @'
// services/payments/index.js
import 'dotenv/config'
import express from 'express'
import Stripe from 'stripe'
import pg from 'pg'
import { param, validationResult } from 'express-validator'

const { Pool } = pg
const app = express()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0.10')

app.use('/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /payments/connect/onboard
app.post('/payments/connect/onboard', async (req, res) => {
  const userId = req.headers['x-user-id']
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'
  try {
    const existing = await pool.query('SELECT stripe_account_id, onboarding_complete FROM stripe_accounts WHERE user_id=$1', [userId])
    let stripeAccountId
    if (existing.rows.length > 0) {
      if (existing.rows[0].onboarding_complete) return res.status(409).json({ message: 'Stripe account already connected.' })
      stripeAccountId = existing.rows[0].stripe_account_id
    } else {
      const account = await stripe.accounts.create({ type: 'express', metadata: { taskfinder_user_id: userId } })
      stripeAccountId = account.id
      await pool.query('INSERT INTO stripe_accounts (user_id, stripe_account_id) VALUES ($1,$2)', [userId, stripeAccountId])
    }
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${CLIENT_URL}/onboarding/refresh`,
      return_url: `${CLIENT_URL}/onboarding/complete`,
      type: 'account_onboarding',
    })
    return res.status(200).json({ onboardingUrl: accountLink.url })
  } catch (err) {
    console.error('[onboard]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /payments/tasks/:taskId/fund
app.post('/payments/tasks/:taskId/fund', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  const creatorId = req.headers['x-user-id']
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const taskResult = await client.query(
      "SELECT t.*, b.bidder_id AS earner_id, b.amount AS bid_amount FROM tasks t JOIN bids b ON b.task_id=t.task_id AND b.status='accepted' WHERE t.task_id=$1 AND t.creator_id=$2 AND t.status='in_progress' FOR UPDATE",
      [taskId, creatorId]
    )
    if (taskResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Task not ready for payment.' }) }
    const task = taskResult.rows[0]
    const earnerAccount = await client.query('SELECT stripe_account_id FROM stripe_accounts WHERE user_id=$1 AND onboarding_complete=TRUE', [task.earner_id])
    if (earnerAccount.rows.length === 0) { await client.query('ROLLBACK'); return res.status(402).json({ message: 'Earner has not completed payment onboarding.' }) }
    const amountCents = Math.round(parseFloat(task.bid_amount) * 100)
    const feeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents, currency: 'usd', capture_method: 'manual',
      application_fee_amount: feeCents,
      transfer_data: { destination: earnerAccount.rows[0].stripe_account_id },
      metadata: { task_id: taskId, creator_id: creatorId, earner_id: task.earner_id },
    })
    await client.query(
      'INSERT INTO escrow_transactions (task_id,creator_id,earner_id,amount_cents,platform_fee_cents,stripe_payment_intent_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [taskId, creatorId, task.earner_id, amountCents, feeCents, paymentIntent.id, 'pending']
    )
    await client.query('COMMIT')
    return res.status(200).json({ clientSecret: paymentIntent.client_secret, amountCents, feeCents })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[fund]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  } finally {
    client.release()
  }
})

// POST /payments/tasks/:taskId/release
app.post('/payments/tasks/:taskId/release', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const escrow = await client.query("SELECT * FROM escrow_transactions WHERE task_id=$1 AND status='funded' FOR UPDATE", [taskId])
    if (escrow.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'No funded escrow found.' }) }
    const captured = await stripe.paymentIntents.capture(escrow.rows[0].stripe_payment_intent_id)
    await client.query("UPDATE escrow_transactions SET status='released', released_at=NOW(), stripe_transfer_id=$1 WHERE escrow_id=$2", [captured.transfer, escrow.rows[0].escrow_id])
    await client.query("UPDATE tasks SET status='completed' WHERE task_id=$1", [taskId])
    await client.query('COMMIT')
    return res.status(200).json({ message: 'Funds released.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[release]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  } finally {
    client.release()
  }
})

// POST /payments/tasks/:taskId/refund  (admin only)
app.post('/payments/tasks/:taskId/refund', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const escrow = await client.query("SELECT * FROM escrow_transactions WHERE task_id=$1 AND status IN ('funded','disputed') FOR UPDATE", [taskId])
    if (escrow.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'No refundable escrow found.' }) }
    await stripe.paymentIntents.cancel(escrow.rows[0].stripe_payment_intent_id)
    await client.query("UPDATE escrow_transactions SET status='refunded', refunded_at=NOW() WHERE escrow_id=$1", [escrow.rows[0].escrow_id])
    await client.query("UPDATE tasks SET status='completed' WHERE task_id=$1", [taskId])
    await client.query('COMMIT')
    return res.status(200).json({ message: 'Refund processed.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[refund]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  } finally {
    client.release()
  }
})

// POST /payments/webhook
app.post('/payments/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` })
  }
  if (event.type === 'payment_intent.amount_capturable_updated') {
    const intent = event.data.object
    await pool.query("UPDATE escrow_transactions SET status='funded', funded_at=NOW() WHERE stripe_payment_intent_id=$1 AND status='pending'", [intent.id])
  }
  return res.status(200).json({ received: true })
})

const PORT = process.env.PORT || 3003
app.listen(PORT, () => console.log(`Payments service running on port ${PORT}`))
'@

# ============================================================
# SERVICES/MATCHING/INDEX.JS
# ============================================================
Write-File "services\matching\index.js" @'
// services/matching/index.js
import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { connect as connectMQ, subscribe, publish } from '../messaging/eventBus.js'

const { Pool } = pg
const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const MAX_MATCHES = parseInt(process.env.MAX_MATCHES_PER_TASK || '20')
const MIN_SCORE   = parseFloat(process.env.MIN_MATCH_SCORE || '0.25')

function jaccardScore(taskTags, earnerSkills) {
  if (!taskTags?.length || !earnerSkills?.length) return 0
  const taskSet   = new Set(taskTags.map(s => s.toLowerCase().trim()))
  const earnerSet = new Set(earnerSkills.map(s => s.toLowerCase().trim()))
  let intersection = 0
  for (const s of earnerSet) if (taskSet.has(s)) intersection++
  return intersection / (taskSet.size + earnerSet.size - intersection)
}

async function runMatchingForTask(taskId, taskTags) {
  if (!taskTags?.length) return 0
  const { rows } = await pool.query(
    "SELECT u.user_id, up.skills, up.avg_rating FROM users u JOIN user_profiles up ON u.user_id=up.user_id WHERE u.role='earner' AND up.skills && $1::TEXT[] AND up.skills IS NOT NULL",
    [taskTags]
  )
  if (!rows.length) return 0
  const scored = rows
    .map(e => {
      const base    = jaccardScore(taskTags, e.skills)
      const bonus   = Math.max(0, (parseFloat(e.avg_rating) || 0 - 3) * 0.10)
      return { userId: e.user_id, score: Math.min(1.0, base + base * bonus) }
    })
    .filter(e => e.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
  if (!scored.length) return 0
  const values = scored.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ')
  const params  = [taskId]
  scored.forEach(e => params.push(e.userId, e.score.toFixed(2)))
  await pool.query(
    `INSERT INTO task_matches (task_id, earner_id, score) VALUES ${values} ON CONFLICT (task_id, earner_id) DO UPDATE SET score = EXCLUDED.score`,
    params
  )
  for (const match of scored) publish('task.matched', { taskId, earnerId: match.userId, score: match.score })
  return scored.length
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.get('/matching/suggestions', async (req, res) => {
  const userId = req.headers['x-user-id']
  const { limit = 10 } = req.query
  try {
    const { rows } = await pool.query(
      "SELECT t.*, tm.score AS match_score FROM task_matches tm JOIN tasks t ON tm.task_id=t.task_id WHERE tm.earner_id=$1 AND t.status='open' AND t.deadline > NOW() ORDER BY tm.score DESC, t.created_at DESC LIMIT $2",
      [userId, limit]
    )
    return res.status(200).json({ suggestions: rows })
  } catch (err) {
    console.error('[suggestions]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

async function startConsumers() {
  await connectMQ()
  await subscribe('task.created', 'matching.task.created', async (p) => {
    const count = await runMatchingForTask(p.taskId, p.skillTags)
    console.log(`[matching] Matched ${count} earners for task ${p.taskId}`)
  })
}

const PORT = process.env.PORT || 3005
app.listen(PORT, async () => {
  await startConsumers()
  console.log(`Matching service running on port ${PORT}`)
})

export { runMatchingForTask }
'@

# ============================================================
# SERVICES/REVIEWS/INDEX.JS
# ============================================================
Write-File "services\reviews\index.js" @'
// services/reviews/index.js
import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { body, param, validationResult } from 'express-validator'

const { Pool } = pg
const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

async function recalculateRating(client, userId) {
  const { rows } = await client.query(
    'SELECT ROUND(AVG(rating)::NUMERIC,1) AS avg_rating, COUNT(*) AS rating_count FROM reviews WHERE reviewee_id=$1', [userId]
  )
  await client.query('UPDATE user_profiles SET avg_rating=$1, rating_count=$2 WHERE user_id=$3', [rows[0].avg_rating || 0, rows[0].rating_count, userId])
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /reviews
app.post('/reviews',
  [body('task_id').isUUID(), body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim()],
  handleValidation,
  async (req, res) => {
    const { task_id, rating, comment = null } = req.body
    const reviewerId = req.headers['x-user-id']
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskResult = await client.query('SELECT task_id, creator_id, assigned_to, status FROM tasks WHERE task_id=$1', [task_id])
      if (taskResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Task not found.' }) }
      const task = taskResult.rows[0]
      if (task.status !== 'completed') { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Task not completed.' }) }
      let revieweeId, role
      if (task.creator_id === reviewerId) { revieweeId = task.assigned_to; role = 'creator' }
      else if (task.assigned_to === reviewerId) { revieweeId = task.creator_id; role = 'earner' }
      else { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not a participant.' }) }
      const { rows } = await client.query(
        'INSERT INTO reviews (task_id,reviewer_id,reviewee_id,rating,comment,role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [task_id, reviewerId, revieweeId, rating, comment, role]
      )
      await recalculateRating(client, revieweeId)
      await client.query('COMMIT')
      return res.status(201).json({ review: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') return res.status(409).json({ message: 'Already reviewed.' })
      console.error('[POST /reviews]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// GET /reviews/user/:userId
app.get('/reviews/user/:userId', [param('userId').isUUID()], handleValidation, async (req, res) => {
  const { userId } = req.params
  try {
    const [reviews, summary] = await Promise.all([
      pool.query('SELECT r.*, up.display_name AS reviewer_name, t.title AS task_title FROM reviews r JOIN user_profiles up ON r.reviewer_id=up.user_id JOIN tasks t ON r.task_id=t.task_id WHERE r.reviewee_id=$1 ORDER BY r.created_at DESC LIMIT 20', [userId]),
      pool.query('SELECT avg_rating, rating_count FROM user_profiles WHERE user_id=$1', [userId]),
    ])
    return res.status(200).json({ summary: summary.rows[0], reviews: reviews.rows })
  } catch (err) {
    console.error('[GET /reviews]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

const PORT = process.env.PORT || 3006
app.listen(PORT, () => console.log(`Reviews service running on port ${PORT}`))
'@

# ============================================================
# SERVICES/DISPUTES/INDEX.JS
# ============================================================
Write-File "services\disputes\index.js" @'
// services/disputes/index.js
import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { body, param, validationResult } from 'express-validator'
import axios from 'axios'

const { Pool } = pg
const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const PAYMENTS_URL = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3003'

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

async function logEvent(client, { disputeId, actorId, action, note = null }) {
  await client.query('INSERT INTO dispute_events (dispute_id,actor_id,action,note) VALUES ($1,$2,$3,$4)', [disputeId, actorId, action, note])
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /disputes
app.post('/disputes',
  [body('task_id').isUUID(), body('reason').trim().notEmpty().isLength({ max: 2000 })],
  handleValidation,
  async (req, res) => {
    const { task_id, reason, evidence_urls = [] } = req.body
    const raisedBy = req.headers['x-user-id']
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskResult = await client.query('SELECT task_id,creator_id,assigned_to,status FROM tasks WHERE task_id=$1 FOR UPDATE', [task_id])
      if (taskResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Task not found.' }) }
      const task = taskResult.rows[0]
      if (![task.creator_id, task.assigned_to].includes(raisedBy)) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not a participant.' }) }
      if (!['in_progress', 'completed'].includes(task.status)) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Cannot dispute this task.' }) }
      const { rows } = await client.query('INSERT INTO disputes (task_id,raised_by,reason,evidence_urls) VALUES ($1,$2,$3,$4) RETURNING *', [task_id, raisedBy, reason, evidence_urls])
      await client.query("UPDATE tasks SET status='disputed' WHERE task_id=$1", [task_id])
      await client.query("UPDATE escrow_transactions SET status='disputed' WHERE task_id=$1 AND status='funded'", [task_id])
      await logEvent(client, { disputeId: rows[0].dispute_id, actorId: raisedBy, action: 'opened', note: reason })
      await client.query('COMMIT')
      return res.status(201).json({ dispute: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') return res.status(409).json({ message: 'Dispute already exists.' })
      console.error('[POST /disputes]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// GET /disputes
app.get('/disputes', async (req, res) => {
  const { status = 'open', limit = 20, offset = 0 } = req.query
  try {
    const { rows } = await pool.query(
      "SELECT d.*, t.title AS task_title, t.budget, uc.email AS creator_email, ue.email AS earner_email FROM disputes d JOIN tasks t ON d.task_id=t.task_id JOIN users uc ON t.creator_id=uc.user_id LEFT JOIN users ue ON t.assigned_to=ue.user_id WHERE d.status=$1 ORDER BY d.opened_at ASC LIMIT $2 OFFSET $3",
      [status, limit, offset]
    )
    return res.status(200).json({ disputes: rows, count: rows.length })
  } catch (err) {
    console.error('[GET /disputes]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /disputes/:disputeId
app.get('/disputes/:disputeId', [param('disputeId').isUUID()], handleValidation, async (req, res) => {
  const { disputeId } = req.params
  try {
    const [dispute, timeline] = await Promise.all([
      pool.query('SELECT d.*, t.title, t.description, t.budget, t.creator_id, t.assigned_to, et.amount_cents, et.status AS escrow_status FROM disputes d JOIN tasks t ON d.task_id=t.task_id LEFT JOIN escrow_transactions et ON t.task_id=et.task_id WHERE d.dispute_id=$1', [disputeId]),
      pool.query('SELECT de.*, u.email AS actor_email FROM dispute_events de JOIN users u ON de.actor_id=u.user_id WHERE de.dispute_id=$1 ORDER BY de.created_at ASC', [disputeId]),
    ])
    if (dispute.rows.length === 0) return res.status(404).json({ message: 'Dispute not found.' })
    const messages = await pool.query('SELECT m.*, up.display_name AS sender_name FROM messages m JOIN user_profiles up ON m.sender_id=up.user_id WHERE m.task_id=$1 ORDER BY m.created_at ASC', [dispute.rows[0].task_id])
    return res.status(200).json({ dispute: dispute.rows[0], timeline: timeline.rows, messages: messages.rows })
  } catch (err) {
    console.error('[GET /disputes/:id]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /disputes/:disputeId/resolve
app.post('/disputes/:disputeId/resolve',
  [param('disputeId').isUUID(), body('resolution').isIn(['refund', 'release']), body('admin_notes').trim().notEmpty()],
  handleValidation,
  async (req, res) => {
    const { disputeId } = req.params
    const { resolution, admin_notes } = req.body
    const adminId = req.headers['x-user-id']
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query("SELECT d.*, t.creator_id, t.assigned_to AS earner_id FROM disputes d JOIN tasks t ON d.task_id=t.task_id WHERE d.dispute_id=$1 AND d.status='open' FOR UPDATE", [disputeId])
      if (result.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Dispute not found or not open.' }) }
      const dispute = result.rows[0]
      const resolvedStatus = resolution === 'refund' ? 'resolved_creator' : 'resolved_earner'
      await client.query('UPDATE disputes SET status=$1, resolution=$2, admin_notes=$3, resolved_at=NOW() WHERE dispute_id=$4', [resolvedStatus, resolution, admin_notes, disputeId])
      await logEvent(client, { disputeId, actorId: adminId, action: 'resolved', note: `Resolution: ${resolution}. ${admin_notes}` })
      await client.query('COMMIT')
      const endpoint = resolution === 'refund' ? `/payments/tasks/${dispute.task_id}/refund` : `/payments/tasks/${dispute.task_id}/release`
      await axios.post(`${PAYMENTS_URL}${endpoint}`, {}, { headers: { 'X-User-Id': adminId, 'X-User-Role': 'admin' } })
      return res.status(200).json({ message: `Dispute resolved — ${resolution}.` })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[resolve]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

const PORT = process.env.PORT || 3007
app.listen(PORT, () => console.log(`Disputes service running on port ${PORT}`))
'@

# ============================================================
# SERVICES/JOBS/SCHEDULER.JS
# ============================================================
Write-File "services\jobs\scheduler.js" @'
// services/jobs/scheduler.js
import 'dotenv/config'
import pg from 'pg'
import cron from 'node-cron'
import amqplib from 'amqplib'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let channel = null

async function connectMQ() {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL)
    channel = await conn.createChannel()
    await channel.assertExchange('taskfinder.events', 'topic', { durable: true })
    console.log('[scheduler] RabbitMQ connected')
  } catch (err) {
    console.error('[scheduler] RabbitMQ failed:', err.message)
    setTimeout(connectMQ, 5000)
  }
}

function publish(key, payload) {
  if (channel) channel.publish('taskfinder.events', key, Buffer.from(JSON.stringify(payload)), { persistent: true })
}

async function logJobStart(jobName) {
  const { rows } = await pool.query("INSERT INTO job_audit_log (job_name, status) VALUES ($1,'started') RETURNING log_id", [jobName])
  return rows[0].log_id
}

async function logJobComplete(logId, records) {
  await pool.query("UPDATE job_audit_log SET status='completed', records_affected=$1, completed_at=NOW() WHERE log_id=$2", [records, logId])
}

async function logJobFailed(logId, error) {
  await pool.query("UPDATE job_audit_log SET status='failed', error_message=$1, completed_at=NOW() WHERE log_id=$2", [error, logId])
}

async function expireStaleTasksJob() {
  const logId = await logJobStart('expire_stale_tasks')
  try {
    const { rows } = await pool.query("UPDATE tasks SET status='expired' WHERE status='open' AND deadline < NOW() RETURNING task_id, creator_id, title")
    for (const task of rows) publish('task.expired', { taskId: task.task_id, creatorId: task.creator_id, taskTitle: task.title })
    await logJobComplete(logId, rows.length)
    console.log(`[scheduler] expired ${rows.length} tasks`)
  } catch (err) {
    await logJobFailed(logId, err.message)
  }
}

async function cleanOrphanedMatchesJob() {
  const logId = await logJobStart('clean_orphaned_matches')
  try {
    const { rowCount } = await pool.query("DELETE FROM task_matches WHERE task_id IN (SELECT task_id FROM tasks WHERE status != 'open')")
    await logJobComplete(logId, rowCount)
  } catch (err) {
    await logJobFailed(logId, err.message)
  }
}

async function purgeOldNotificationsJob() {
  const logId = await logJobStart('purge_old_notifications')
  const days = parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '90')
  try {
    const { rowCount } = await pool.query("DELETE FROM notifications WHERE is_read=TRUE AND created_at < NOW() - ($1 || ' days')::INTERVAL", [days])
    await logJobComplete(logId, rowCount)
  } catch (err) {
    await logJobFailed(logId, err.message)
  }
}

async function start() {
  await connectMQ()
  cron.schedule('0 * * * *',   expireStaleTasksJob)
  cron.schedule('0 2 * * *',   cleanOrphanedMatchesJob)
  cron.schedule('0 4 * * 0',   purgeOldNotificationsJob)
  console.log('[scheduler] All jobs registered')
}

start()
'@

Write-Host ""
Write-Host "Creating database schemas..." -ForegroundColor Yellow

# ============================================================
# DB SCHEMAS
# ============================================================
Write-File "db\init\01_users_schema.sql" @'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(10) NOT NULL DEFAULT 'earner' CHECK (role IN ('creator','earner','admin')),
    is_verified   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_profiles (
    profile_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    display_name  VARCHAR(100),
    bio           TEXT,
    avatar_url    TEXT,
    skills        TEXT[],
    portfolio_url TEXT,
    avg_rating    NUMERIC(2,1) DEFAULT 0.0 CHECK (avg_rating BETWEEN 0 AND 5),
    rating_count  INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_profiles_skills ON user_profiles USING GIN(skills);
'@

Write-File "db\init\02_tasks_schema.sql" @'
CREATE TABLE tasks (
    task_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT NOT NULL,
    budget       NUMERIC(10,2) NOT NULL CHECK (budget > 0),
    deadline     TIMESTAMPTZ NOT NULL,
    skill_tags   TEXT[],
    status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','disputed','completed','expired')),
    assigned_to  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bids (
    bid_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    bidder_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    pitch      TEXT NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_active_bid UNIQUE (task_id, bidder_id)
);

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_bids_updated_at  BEFORE UPDATE ON bids  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX idx_tasks_status     ON tasks(status);
CREATE INDEX idx_tasks_skill_tags ON tasks USING GIN(skill_tags);
CREATE INDEX idx_bids_task_id     ON bids(task_id);
CREATE INDEX idx_bids_bidder_id   ON bids(bidder_id);
'@

Write-File "db\init\03_payments_schema.sql" @'
CREATE TABLE stripe_accounts (
    account_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    stripe_account_id   TEXT UNIQUE NOT NULL,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE escrow_transactions (
    escrow_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                  UUID UNIQUE NOT NULL REFERENCES tasks(task_id) ON DELETE RESTRICT,
    creator_id               UUID NOT NULL REFERENCES users(user_id),
    earner_id                UUID NOT NULL REFERENCES users(user_id),
    amount_cents             INTEGER NOT NULL CHECK (amount_cents > 0),
    platform_fee_cents       INTEGER NOT NULL DEFAULT 0,
    currency                 CHAR(3) NOT NULL DEFAULT 'usd',
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_transfer_id       TEXT,
    status                   VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','funded','released','refunded','disputed')),
    funded_at                TIMESTAMPTZ,
    released_at              TIMESTAMPTZ,
    refunded_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_escrow_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_escrow_task_id    ON escrow_transactions(task_id);
CREATE INDEX idx_escrow_creator_id ON escrow_transactions(creator_id);
CREATE INDEX idx_escrow_status     ON escrow_transactions(status);
'@

Write-File "db\init\04_messaging_schema.sql" @'
CREATE TABLE messages (
    message_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    task_id     UUID REFERENCES tasks(task_id) ON DELETE SET NULL,
    content     TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_self_message CHECK (sender_id != receiver_id)
);

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    reference_id    UUID,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_sender_id   ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_notifs_user_id       ON notifications(user_id);
CREATE INDEX idx_notifs_unread        ON notifications(user_id, is_read) WHERE is_read = FALSE;
'@

Write-File "db\init\05_matching_schema.sql" @'
CREATE TABLE task_matches (
    match_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    earner_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    score        NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_notified  BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_task_earner UNIQUE (task_id, earner_id)
);

CREATE TABLE job_audit_log (
    log_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name         VARCHAR(100) NOT NULL,
    status           VARCHAR(20) NOT NULL CHECK (status IN ('started','completed','failed')),
    records_affected INTEGER DEFAULT 0,
    error_message    TEXT,
    started_at       TIMESTAMPTZ DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_matches_earner_id   ON task_matches(earner_id);
CREATE INDEX idx_matches_task_id     ON task_matches(task_id);
CREATE INDEX idx_matches_unnotified  ON task_matches(is_notified) WHERE is_notified = FALSE;
'@

Write-File "db\init\06_reviews_schema.sql" @'
CREATE TABLE reviews (
    review_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(task_id) ON DELETE RESTRICT,
    reviewer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('creator','earner')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_review UNIQUE (task_id, reviewer_id)
);

CREATE TABLE disputes (
    dispute_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID UNIQUE NOT NULL REFERENCES tasks(task_id) ON DELETE RESTRICT,
    raised_by      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason         TEXT NOT NULL,
    evidence_urls  TEXT[],
    status         VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved_creator','resolved_earner','closed')),
    assigned_admin UUID REFERENCES users(user_id) ON DELETE SET NULL,
    admin_notes    TEXT,
    resolution     VARCHAR(20) CHECK (resolution IN ('refund','release','split')),
    opened_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispute_events (
    event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES disputes(dispute_id) ON DELETE CASCADE,
    actor_id   UUID NOT NULL REFERENCES users(user_id),
    action     VARCHAR(50) NOT NULL,
    note       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_disputes_task_id    ON disputes(task_id);
CREATE INDEX idx_disputes_status     ON disputes(status);
CREATE INDEX idx_dispute_events      ON dispute_events(dispute_id);
'@

Write-Host ""
Write-Host "Creating docker-compose.yml..." -ForegroundColor Yellow

# ============================================================
# DOCKER-COMPOSE.YML
# ============================================================
Write-File "docker-compose.yml" @'
version: '3.9'

x-service-defaults: &service-defaults
  restart: unless-stopped
  networks:
    - taskfinder-internal
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy

services:

  postgres:
    image: postgres:16-alpine
    container_name: taskfinder-postgres
    restart: unless-stopped
    networks:
      - taskfinder-internal
    environment:
      POSTGRES_USER:     ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB:       ${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: taskfinder-redis
    restart: unless-stopped
    networks:
      - taskfinder-internal
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: taskfinder-rabbitmq
    restart: unless-stopped
    networks:
      - taskfinder-internal
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 15s
      timeout: 10s
      retries: 5
    ports:
      - "5672:5672"
      - "15672:15672"

  gateway:
    <<: *service-defaults
    build:
      context: ./gateway
      dockerfile: Dockerfile
    container_name: taskfinder-gateway
    env_file: .env
    environment:
      NODE_ENV: production
      GATEWAY_PORT: 8080
      AUTH_SERVICE_URL:      http://auth:3001
      TASKS_SERVICE_URL:     http://tasks:3002
      PAYMENTS_SERVICE_URL:  http://payments:3003
      MESSAGING_SERVICE_URL: http://messaging:3004
      MATCHING_SERVICE_URL:  http://matching:3005
      REVIEWS_SERVICE_URL:   http://reviews:3006
      DISPUTES_SERVICE_URL:  http://disputes:3007
    ports:
      - "8080:8080"
    depends_on:
      - auth
      - tasks
      - payments
      - messaging
      - matching
      - reviews
      - disputes

  auth:
    <<: *service-defaults
    build:
      context: ./services/auth
      dockerfile: Dockerfile
    container_name: taskfinder-auth
    env_file: .env
    environment:
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    expose:
      - "3001"

  tasks:
    <<: *service-defaults
    build:
      context: ./services/tasks
      dockerfile: Dockerfile
    container_name: taskfinder-tasks
    env_file: .env
    environment:
      PORT: 3002
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
    expose:
      - "3002"

  payments:
    <<: *service-defaults
    build:
      context: ./services/payments
      dockerfile: Dockerfile
    container_name: taskfinder-payments
    env_file: .env
    environment:
      PORT: 3003
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
    expose:
      - "3003"

  messaging:
    <<: *service-defaults
    build:
      context: ./services/messaging
      dockerfile: Dockerfile
    container_name: taskfinder-messaging
    env_file: .env
    environment:
      PORT: 3004
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      REDIS_URL:    redis://:${REDIS_PASSWORD}@redis:6379
    expose:
      - "3004"

  matching:
    <<: *service-defaults
    build:
      context: ./services/matching
      dockerfile: Dockerfile
    container_name: taskfinder-matching
    env_file: .env
    environment:
      PORT: 3005
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
    expose:
      - "3005"

  reviews:
    <<: *service-defaults
    build:
      context: ./services/reviews
      dockerfile: Dockerfile
    container_name: taskfinder-reviews
    env_file: .env
    environment:
      PORT: 3006
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    expose:
      - "3006"

  disputes:
    <<: *service-defaults
    build:
      context: ./services/disputes
      dockerfile: Dockerfile
    container_name: taskfinder-disputes
    env_file: .env
    environment:
      PORT: 3007
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
      PAYMENTS_SERVICE_URL: http://payments:3003
    expose:
      - "3007"

  scheduler:
    <<: *service-defaults
    build:
      context: ./services/jobs
      dockerfile: Dockerfile
    container_name: taskfinder-scheduler
    env_file: .env
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672

volumes:
  postgres-data:
  redis-data:
  rabbitmq-data:

networks:
  taskfinder-internal:
    driver: bridge
'@

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " All files created successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Running final tree check..." -ForegroundColor Yellow
