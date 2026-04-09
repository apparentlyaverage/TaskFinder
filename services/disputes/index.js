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
      return res.status(200).json({ message: `Dispute resolved â€” ${resolution}.` })
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