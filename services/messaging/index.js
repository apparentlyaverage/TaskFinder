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