// server/routes/tasks.js — tasks + bids (merged from services/tasks)
// Changes from the standalone service:
//   • RabbitMQ publish() → direct createNotification() calls
//   • x-user-id header → req.userId from JWT middleware
//   • NEW: PATCH /:taskId/complete — with escrow deferred, completing a task
//     is a status flip by the creator (was previously owned by payments service)
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { createNotification } from '../notify.js'
import { requireAuth } from '../middleware.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// POST /tasks — create a task
router.post('/',
  requireAuth,
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').trim().notEmpty(),
    body('budget').isFloat({ gt: 0 }),
    body('deadline').isISO8601(),
    body('skill_tags').optional().isArray(),
    body('campus_zone').optional().trim(),
  ],
  check,
  async (req, res) => {
    const { title, description, budget, deadline, skill_tags = [], campus_zone = null } = req.body
    if (new Date(deadline) <= new Date()) {
      return res.status(400).json({ message: 'Deadline must be in the future.' })
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO tasks (creator_id, title, description, budget, deadline, skill_tags, campus_zone)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.userId, title, description, budget, deadline, skill_tags, campus_zone]
      )
      return res.status(201).json({ task: rows[0] })
    } catch (err) {
      log.error('POST /tasks', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /tasks — browse open tasks (public, no auth needed)
router.get('/', async (req, res) => {
  const { skill, status = 'open', limit = 20, offset = 0 } = req.query
  try {
    let query, params
    if (skill) {
      query = `SELECT t.*, up.display_name AS creator_name,
                      (SELECT COUNT(*) FROM bids b WHERE b.task_id = t.task_id AND b.status != 'withdrawn')::int AS bid_count
               FROM tasks t LEFT JOIN user_profiles up ON t.creator_id = up.user_id
               WHERE t.status = $1 AND t.skill_tags @> ARRAY[$2]::TEXT[]
               ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`
      params = [status, skill, limit, offset]
    } else {
      query = `SELECT t.*, up.display_name AS creator_name,
                      (SELECT COUNT(*) FROM bids b WHERE b.task_id = t.task_id AND b.status != 'withdrawn')::int AS bid_count
               FROM tasks t LEFT JOIN user_profiles up ON t.creator_id = up.user_id
               WHERE t.status = $1
               ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`
      params = [status, limit, offset]
    }
    const { rows } = await pool.query(query, params)
    return res.status(200).json({ tasks: rows })
  } catch (err) {
    log.error('GET /tasks', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /tasks/mine — tasks I created or am assigned to (must precede /:taskId)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tasks WHERE creator_id = $1 OR assigned_to = $1 ORDER BY created_at DESC`,
      [req.userId]
    )
    return res.status(200).json({ tasks: rows })
  } catch (err) {
    log.error('GET /tasks/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /tasks/bids/mine — all bids the logged-in earner has placed, with task info
router.get('/bids/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, t.title AS task_title, t.budget AS task_budget,
              t.status AS task_status, t.deadline AS task_deadline
       FROM bids b
       JOIN tasks t ON b.task_id = t.task_id
       WHERE b.bidder_id = $1
       ORDER BY b.created_at DESC`,
      [req.userId]
    )
    return res.status(200).json({ bids: rows })
  } catch (err) {
    log.error('GET /tasks/bids/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// PATCH /tasks/bids/:bidId/withdraw — earner withdraws their own pending bid
router.patch('/bids/:bidId/withdraw',
  requireAuth,
  [param('bidId').isUUID()],
  check,
  async (req, res) => {
    const { bidId } = req.params
    try {
      const { rows } = await pool.query(
        `UPDATE bids SET status = 'withdrawn', updated_at = NOW()
         WHERE bid_id = $1 AND bidder_id = $2 AND status = 'pending'
         RETURNING *`,
        [bidId, req.userId]
      )
      if (rows.length === 0) return res.status(404).json({ message: 'Bid not found or not withdrawable.' })
      return res.status(200).json({ bid: rows[0] })
    } catch (err) {
      log.error('withdraw bid', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /tasks/:taskId — task detail with bids
router.get('/:taskId', [param('taskId').isUUID()], check, async (req, res) => {
  const { taskId } = req.params
  try {
    const taskResult = await pool.query(
      `SELECT t.*, up.display_name AS creator_name
       FROM tasks t LEFT JOIN user_profiles up ON t.creator_id = up.user_id
       WHERE t.task_id = $1`, [taskId])
    if (taskResult.rows.length === 0) return res.status(404).json({ message: 'Task not found.' })
    const bidsResult = await pool.query(
      `SELECT b.*, up.display_name, up.avg_rating
       FROM bids b JOIN user_profiles up ON b.bidder_id = up.user_id
       WHERE b.task_id = $1 ORDER BY b.amount ASC`, [taskId])
    return res.status(200).json({ task: taskResult.rows[0], bids: bidsResult.rows })
  } catch (err) {
    log.error('GET /tasks/:taskId', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /tasks/:taskId/bids — submit a bid
router.post('/:taskId/bids',
  requireAuth,
  [param('taskId').isUUID(), body('amount').isFloat({ gt: 0 }), body('pitch').trim().notEmpty()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    const { amount, pitch } = req.body
    try {
      const taskResult = await pool.query(
        'SELECT task_id, creator_id, status, title FROM tasks WHERE task_id = $1', [taskId])
      if (taskResult.rows.length === 0) return res.status(404).json({ message: 'Task not found.' })
      const task = taskResult.rows[0]
      if (task.status !== 'open') return res.status(409).json({ message: 'Task is no longer accepting bids.' })
      if (task.creator_id === req.userId) return res.status(403).json({ message: 'You cannot bid on your own task.' })

      const { rows } = await pool.query(
        'INSERT INTO bids (task_id, bidder_id, amount, pitch) VALUES ($1,$2,$3,$4) RETURNING *',
        [taskId, req.userId, amount, pitch]
      )

      // Direct notification — replaces RabbitMQ bid.submitted event
      createNotification({
        userId: task.creator_id,
        type: 'bid.submitted',
        title: 'New bid on your task',
        body: `Someone bid R${amount} on "${task.title}".`,
        referenceId: taskId,
      })

      return res.status(201).json({ bid: rows[0] })
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ message: 'You have already bid on this task.' })
      log.error('POST bids', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /tasks/:taskId/bids/:bidId/accept — creator accepts a bid
router.patch('/:taskId/bids/:bidId/accept',
  requireAuth,
  [param('taskId').isUUID(), param('bidId').isUUID()],
  check,
  async (req, res) => {
    const { taskId, bidId } = req.params
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskResult = await client.query(
        'SELECT * FROM tasks WHERE task_id = $1 AND creator_id = $2 FOR UPDATE',
        [taskId, req.userId])
      if (taskResult.rows.length === 0 || taskResult.rows[0].status !== 'open') {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Task not found or not open.' })
      }
      const bidResult = await client.query(
        'SELECT * FROM bids WHERE bid_id = $1 AND task_id = $2', [bidId, taskId])
      if (bidResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Bid not found.' })
      }
      const winningBid = bidResult.rows[0]
      await client.query("UPDATE bids SET status = 'accepted' WHERE bid_id = $1", [bidId])
      await client.query("UPDATE bids SET status = 'rejected' WHERE task_id = $1 AND bid_id != $2", [taskId, bidId])
      await client.query("UPDATE tasks SET status = 'in_progress', assigned_to = $1 WHERE task_id = $2",
        [winningBid.bidder_id, taskId])
      await client.query('COMMIT')

      // Direct notification — replaces RabbitMQ bid.accepted event
      createNotification({
        userId: winningBid.bidder_id,
        type: 'bid.accepted',
        title: 'Your bid was accepted!',
        body: `Your bid on "${taskResult.rows[0].title}" was accepted. You can start work now.`,
        referenceId: taskId,
      })

      return res.status(200).json({ message: 'Bid accepted.', assignedTo: winningBid.bidder_id })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('accept bid', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// PATCH /tasks/:taskId/complete — creator marks task done
// NEW for MVP: with escrow deferred this is a simple status transition.
// When Stripe escrow lands post-launch, capture/transfer logic slots in here.
router.patch('/:taskId/complete',
  requireAuth,
  [param('taskId').isUUID()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    try {
      const { rows } = await pool.query(
        `UPDATE tasks SET status = 'completed', updated_at = NOW()
         WHERE task_id = $1 AND creator_id = $2 AND status = 'in_progress'
         RETURNING *`,
        [taskId, req.userId]
      )
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Task not found, not yours, or not in progress.' })
      }
      const task = rows[0]
      if (task.assigned_to) {
        createNotification({
          userId: task.assigned_to,
          type: 'task.completed',
          title: 'Task marked complete',
          body: `"${task.title}" was marked complete. You can now review each other.`,
          referenceId: taskId,
        })
      }
      return res.status(200).json({ task })
    } catch (err) {
      log.error('complete task', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
