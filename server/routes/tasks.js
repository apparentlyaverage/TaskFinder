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
import { rejectIfProfane } from '../profanity.js'
import { expireDueTasks } from '../jobs.js'
import { validateLocationName } from '../locationValidate.js'

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
    // A5: a real zone lets Browse Tasks sort by proximity. Fail-open on a DB
    // hiccup (see validateLocationName) — location must never block posting.
    body('campus_zone').optional({ nullable: true }).trim().custom(validateLocationName),
    body('expected_duration').optional({ nullable: true }).trim().isLength({ max: 40 }),
    body('bids_close_at').optional({ nullable: true }).isISO8601(),
  ],
  check,
  async (req, res) => {
    const { title, description, budget, deadline, skill_tags = [], campus_zone = null, expected_duration = null, bids_close_at = null } = req.body
    if (new Date(deadline) <= new Date()) {
      return res.status(400).json({ message: 'Deadline must be in the future.' })
    }
    if (rejectIfProfane(res, title, description)) return
    try {
      const { rows } = await pool.query(
        `INSERT INTO tasks (creator_id, title, description, budget, deadline, skill_tags, campus_zone, expected_duration, bids_close_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.userId, title, description, budget, deadline, skill_tags, campus_zone, expected_duration, bids_close_at]
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
               WHERE t.status = $1 AND t.archived_at IS NULL AND t.skill_tags @> ARRAY[$2]::TEXT[]
               ORDER BY t.created_at DESC LIMIT $3 OFFSET $4`
      params = [status, skill, limit, offset]
    } else {
      query = `SELECT t.*, up.display_name AS creator_name,
                      (SELECT COUNT(*) FROM bids b WHERE b.task_id = t.task_id AND b.status != 'withdrawn')::int AS bid_count
               FROM tasks t LEFT JOIN user_profiles up ON t.creator_id = up.user_id
               WHERE t.status = $1 AND t.archived_at IS NULL
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

// POST /tasks/admin/expire — manually run the expiry sweep (admin/cron).
// The scheduler runs this on an interval too; this is for ops/cron triggers.
router.post('/admin/expire', requireAuth, async (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin only.' })
  try {
    const expired = await expireDueTasks()
    return res.status(200).json({ expired })
  } catch (err) {
    log.error('POST /tasks/admin/expire', { reqId: req.id, msg: err.message })
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
    if (rejectIfProfane(res, pitch)) return
    try {
      const taskResult = await pool.query(
        'SELECT task_id, creator_id, status, title, bids_close_at FROM tasks WHERE task_id = $1', [taskId])
      if (taskResult.rows.length === 0) return res.status(404).json({ message: 'Task not found.' })
      const task = taskResult.rows[0]
      if (task.status !== 'open') return res.status(409).json({ message: 'Task is no longer accepting bids.' })
      if (task.bids_close_at && new Date(task.bids_close_at) <= new Date()) return res.status(409).json({ message: 'Bidding has closed for this task.' })
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
      await client.query("UPDATE tasks SET status = 'in_progress', assigned_to = $1, agreed_amount = $2 WHERE task_id = $3",
        [winningBid.bidder_id, winningBid.amount, taskId])
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

// PATCH /tasks/:taskId/submit — the assigned earner submits finished work for
// the creator to review (in_progress → submitted). First half of the handshake.
router.patch('/:taskId/submit',
  requireAuth,
  [param('taskId').isUUID()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    try {
      const { rows } = await pool.query(
        `UPDATE tasks SET status = 'submitted', updated_at = NOW()
         WHERE task_id = $1 AND assigned_to = $2 AND status = 'in_progress'
         RETURNING *`,
        [taskId, req.userId])
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Task not found, not assigned to you, or not in progress.' })
      }
      const task = rows[0]
      createNotification({
        userId: task.creator_id,
        type: 'task.submitted',
        title: 'Work submitted for review',
        body: `Work on "${task.title}" was submitted. Review it and confirm completion.`,
        referenceId: taskId,
      })
      return res.status(200).json({ task })
    } catch (err) {
      log.error('submit task', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /tasks/:taskId/request-changes — creator sends submitted work back to
// the earner (submitted → in_progress).
router.patch('/:taskId/request-changes',
  requireAuth,
  [param('taskId').isUUID()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    try {
      const { rows } = await pool.query(
        `UPDATE tasks SET status = 'in_progress', updated_at = NOW()
         WHERE task_id = $1 AND creator_id = $2 AND status = 'submitted'
         RETURNING *`,
        [taskId, req.userId])
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Task not found, not yours, or not awaiting review.' })
      }
      const task = rows[0]
      if (task.assigned_to) {
        createNotification({
          userId: task.assigned_to,
          type: 'task.changes_requested',
          title: 'Changes requested',
          body: `The creator asked for changes on "${task.title}".`,
          referenceId: taskId,
        })
      }
      return res.status(200).json({ task })
    } catch (err) {
      log.error('request changes', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /tasks/:taskId/complete — creator confirms completion. Second half of
// the handshake: accepts a 'submitted' task (or 'in_progress', so the creator
// can still complete directly). Escrow release will hook in here later.
router.patch('/:taskId/complete',
  requireAuth,
  [param('taskId').isUUID()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    try {
      const { rows } = await pool.query(
        `UPDATE tasks SET status = 'completed', updated_at = NOW()
         WHERE task_id = $1 AND creator_id = $2 AND status IN ('submitted', 'in_progress')
         RETURNING *`,
        [taskId, req.userId]
      )
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Task not found, not yours, or not ready to complete.' })
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
        // Reliability Score signal (playbook Phase 0 / M12): record the positive
        // behavioural event for the earner. Fire-and-forget — a logging failure
        // must never block task completion.
        pool.query(
          `INSERT INTO score_events (user_id, event_type, weight, reference_id)
           VALUES ($1, 'task_completed', 5.0, $2)`,
          [task.assigned_to, taskId]
        ).catch(err => log.error('score_event task_completed', { reqId: req.id, msg: err.message }))
      }
      return res.status(200).json({ task })
    } catch (err) {
      log.error('complete task', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── PRICE HANDSHAKE (C1/C2): a two-party agreement on the task's price ──
// Load a task + the caller's role in its handshake (creator ↔ assigned earner).
async function loadTaskParty(taskId, userId) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE task_id = $1', [taskId])
  const task = rows[0] || null
  if (!task) return { task: null }
  const isCreator = task.creator_id === userId
  const isEarner = task.assigned_to === userId
  const other = isCreator ? task.assigned_to : (isEarner ? task.creator_id : null)
  return { task, isCreator, isEarner, isParty: isCreator || isEarner, other }
}

// POST /tasks/:taskId/agreements — propose a (new) price. The other party confirms.
router.post('/:taskId/agreements',
  requireAuth,
  [param('taskId').isUUID(), body('amount').isFloat({ gt: 0 }), body('note').optional({ nullable: true }).trim().isLength({ max: 280 })],
  check,
  async (req, res) => {
    const { taskId } = req.params
    const { amount } = req.body
    const note = (req.body.note || '').toString().trim().slice(0, 280) || null
    if (rejectIfProfane(res, note)) return
    try {
      const { task, isParty, other } = await loadTaskParty(taskId, req.userId)
      if (!task) return res.status(404).json({ message: 'Task not found.' })
      if (!isParty) return res.status(403).json({ message: 'Only the task creator or assigned earner can propose a price.' })
      if (!other) return res.status(409).json({ message: 'This task has no assigned earner yet.' })
      if (!['in_progress', 'submitted'].includes(task.status)) return res.status(409).json({ message: 'A price can only be agreed while the task is active.' })
      await pool.query("UPDATE task_agreements SET status = 'superseded' WHERE task_id = $1 AND status = 'proposed'", [taskId])
      const { rows } = await pool.query(
        `INSERT INTO task_agreements (task_id, proposed_by, amount, note) VALUES ($1,$2,$3,$4) RETURNING *`,
        [taskId, req.userId, amount, note])
      createNotification({
        userId: other, type: 'task.price_proposed',
        title: 'New price proposed', body: `A new price of R${amount} was proposed on "${task.title}" — review and confirm.`,
        referenceId: taskId,
      }).catch(() => {})
      return res.status(201).json({ agreement: rows[0] })
    } catch (err) {
      log.error('POST /tasks/:taskId/agreements', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// POST /tasks/:taskId/agreements/:agreementId/respond — the OTHER party accepts/declines.
// Accepting writes tasks.agreed_amount (the on-platform source of truth, C2).
router.post('/:taskId/agreements/:agreementId/respond',
  requireAuth,
  [param('taskId').isUUID(), param('agreementId').isUUID(), body('accept').isBoolean()],
  check,
  async (req, res) => {
    const { taskId, agreementId } = req.params
    const accept = req.body.accept === true
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT a.*, t.creator_id, t.assigned_to, t.title
           FROM task_agreements a JOIN tasks t ON t.task_id = a.task_id
          WHERE a.agreement_id = $1 AND a.task_id = $2 FOR UPDATE`, [agreementId, taskId])
      const ag = rows[0]
      if (!ag) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Proposal not found.' }) }
      if (ag.creator_id !== req.userId && ag.assigned_to !== req.userId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not your task.' }) }
      if (ag.proposed_by === req.userId) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'The other party must confirm your proposal.' }) }
      if (ag.status !== 'proposed') { await client.query('ROLLBACK'); return res.status(409).json({ message: 'This proposal has already been answered.' }) }
      const newStatus = accept ? 'accepted' : 'declined'
      await client.query('UPDATE task_agreements SET status = $1, responded_at = NOW(), responded_by = $2 WHERE agreement_id = $3',
        [newStatus, req.userId, agreementId])
      if (accept) await client.query('UPDATE tasks SET agreed_amount = $1, updated_at = NOW() WHERE task_id = $2', [ag.amount, taskId])
      await client.query('COMMIT')
      createNotification({
        userId: ag.proposed_by, type: `task.price_${newStatus}`,
        title: accept ? 'Price agreed' : 'Price declined',
        body: accept ? `Your proposed price of R${ag.amount} on "${ag.title}" was agreed.` : `Your proposed price on "${ag.title}" was declined.`,
        referenceId: taskId,
      }).catch(() => {})
      return res.status(200).json({ agreement: { ...ag, status: newStatus }, agreedAmount: accept ? ag.amount : null })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('respond agreement', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally { client.release() }
  }
)

// GET /tasks/:taskId/agreements — the handshake history (parties + admin).
router.get('/:taskId/agreements', requireAuth, [param('taskId').isUUID()], check, async (req, res) => {
  try {
    const { task, isParty } = await loadTaskParty(req.params.taskId, req.userId)
    if (!task) return res.status(404).json({ message: 'Task not found.' })
    if (!isParty && req.userRole !== 'admin') return res.status(403).json({ message: 'Not your task.' })
    const { rows } = await pool.query(
      `SELECT a.*, up.display_name AS proposed_by_name
         FROM task_agreements a LEFT JOIN user_profiles up ON up.user_id = a.proposed_by
        WHERE a.task_id = $1 ORDER BY a.created_at DESC`, [req.params.taskId])
    return res.status(200).json({ agreements: rows, agreedAmount: task.agreed_amount })
  } catch (err) {
    log.error('GET /tasks/:taskId/agreements', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// PATCH /tasks/:taskId — creator edits an OPEN task (locked once work starts).
router.patch('/:taskId',
  requireAuth,
  [
    param('taskId').isUUID(),
    body('title').optional().trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim().notEmpty(),
    body('budget').optional().isFloat({ gt: 0 }),
    body('deadline').optional().isISO8601(),
    body('skill_tags').optional().isArray(),
    body('campus_zone').optional({ nullable: true }).trim(),
  ],
  check,
  async (req, res) => {
    const { taskId } = req.params
    if (req.body.deadline && new Date(req.body.deadline) <= new Date()) {
      return res.status(400).json({ message: 'Deadline must be in the future.' })
    }
    const editable = ['title', 'description', 'budget', 'deadline', 'skill_tags', 'campus_zone']
    const sets = []; const vals = []; let i = 1
    for (const f of editable) {
      if (req.body[f] !== undefined) { sets.push(`${f} = $${i++}`); vals.push(req.body[f]) }
    }
    if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update.' })
    sets.push('updated_at = NOW()')
    vals.push(taskId, req.userId)
    try {
      const { rows } = await pool.query(
        `UPDATE tasks SET ${sets.join(', ')}
         WHERE task_id = $${i++} AND creator_id = $${i} AND status = 'open'
         RETURNING *`, vals)
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Task not found, not yours, or no longer editable.' })
      }
      return res.status(200).json({ task: rows[0] })
    } catch (err) {
      log.error('PATCH /tasks/:taskId', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /tasks/:taskId/extend — creator extends an OPEN task's deadline by 7 days
// (capped to 90 days out) so a task about to expire can stay live (B5).
router.patch('/:taskId/extend',
  requireAuth,
  [param('taskId').isUUID()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    try {
      const { rows } = await pool.query(
        `UPDATE tasks
            SET deadline = LEAST(GREATEST(deadline, NOW()) + INTERVAL '7 days', NOW() + INTERVAL '90 days'),
                updated_at = NOW()
          WHERE task_id = $1 AND creator_id = $2 AND status = 'open'
          RETURNING *`, [taskId, req.userId])
      if (rows.length === 0) return res.status(404).json({ message: 'Task not found, not yours, or not open.' })
      return res.status(200).json({ task: rows[0] })
    } catch (err) {
      log.error('PATCH /tasks/:taskId/extend', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /tasks/:taskId/cancel — creator cancels an OPEN task; pending bids are
// rejected and bidders notified.
router.patch('/:taskId/cancel',
  requireAuth,
  [param('taskId').isUUID()],
  check,
  async (req, res) => {
    const { taskId } = req.params
    const reason = (req.body?.reason || '').toString().trim().slice(0, 200) || null
    if (rejectIfProfane(res, reason)) return
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `UPDATE tasks SET status = 'cancelled', cancel_reason = $3, updated_at = NOW()
         WHERE task_id = $1 AND creator_id = $2 AND status = 'open'
         RETURNING *`, [taskId, req.userId, reason])
      if (rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Task not found, not yours, or not cancellable.' })
      }
      await client.query("UPDATE bids SET status = 'rejected' WHERE task_id = $1 AND status = 'pending'", [taskId])
      await client.query('COMMIT')

      const bidders = await pool.query('SELECT DISTINCT bidder_id FROM bids WHERE task_id = $1', [taskId])
      for (const b of bidders.rows) {
        createNotification({
          userId: b.bidder_id,
          type: 'task.cancelled',
          title: 'A task was cancelled',
          body: reason ? `"${rows[0].title}" was cancelled — reason: ${reason}` : `"${rows[0].title}" was cancelled by the creator.`,
          referenceId: taskId,
        })
      }
      return res.status(200).json({ task: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('PATCH /tasks/:taskId/cancel', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

export default router
