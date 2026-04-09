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