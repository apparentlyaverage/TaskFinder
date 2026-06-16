// server/routes/disputes.js — dispute lifecycle (Trust & Safety).
// Schema lives in db/init/06 (disputes, dispute_events). One dispute per task.
// Monetary settlement (refund/release) is recorded but NOT executed — that
// lands with escrow in MVP-3 (payments). For now this is the raise → review →
// resolve workflow that needs no money movement.
import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
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

// POST /disputes — a task participant opens a dispute.
router.post('/',
  requireAuth,
  [
    body('task_id').isUUID(),
    body('reason').trim().notEmpty().isLength({ max: 2000 }),
    body('evidence_urls').optional().isArray({ max: 10 }),
    body('evidence_urls.*').optional().isURL(),
  ],
  check,
  async (req, res) => {
    const { task_id, reason, evidence_urls = null } = req.body
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskRes = await client.query(
        'SELECT task_id, creator_id, assigned_to, status, title FROM tasks WHERE task_id = $1 FOR UPDATE',
        [task_id])
      if (taskRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Task not found.' })
      }
      const task = taskRes.rows[0]
      const isParticipant = task.creator_id === req.userId || task.assigned_to === req.userId
      if (!isParticipant) {
        await client.query('ROLLBACK')
        return res.status(403).json({ message: 'Only a task participant can open a dispute.' })
      }
      if (!['in_progress', 'completed'].includes(task.status)) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Only an active or completed task can be disputed.' })
      }

      const { rows } = await client.query(
        `INSERT INTO disputes (task_id, raised_by, reason, evidence_urls, status)
         VALUES ($1, $2, $3, $4, 'open') RETURNING *`,
        [task_id, req.userId, reason, evidence_urls])
      const dispute = rows[0]

      await client.query("UPDATE tasks SET status = 'disputed', updated_at = NOW() WHERE task_id = $1", [task_id])
      await client.query(
        `INSERT INTO dispute_events (dispute_id, actor_id, action, note)
         VALUES ($1, $2, 'opened', $3)`,
        [dispute.dispute_id, req.userId, reason.slice(0, 200)])
      await client.query('COMMIT')

      const otherParty = task.creator_id === req.userId ? task.assigned_to : task.creator_id
      if (otherParty) {
        createNotification({
          userId: otherParty,
          type: 'dispute.opened',
          title: 'A dispute was opened',
          body: `A dispute was opened on "${task.title}".`,
          referenceId: task_id,
        })
      }
      return res.status(201).json({ dispute })
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') return res.status(409).json({ message: 'This task already has a dispute.' })
      log.error('disputes.open_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// GET /disputes — admins see all (optional ?status=); everyone else sees only
// disputes on tasks they participate in.
router.get('/',
  requireAuth,
  [query('status').optional().isIn(['open', 'under_review', 'resolved_creator', 'resolved_earner', 'closed'])],
  check,
  async (req, res) => {
    const { status } = req.query
    try {
      let rows
      if (req.userRole === 'admin') {
        const params = []
        let where = ''
        if (status) { params.push(status); where = `WHERE d.status = $1` }
        ;({ rows } = await pool.query(
          `SELECT d.*, t.title AS task_title
           FROM disputes d JOIN tasks t ON d.task_id = t.task_id
           ${where} ORDER BY d.opened_at DESC`, params))
      } else {
        ;({ rows } = await pool.query(
          `SELECT d.*, t.title AS task_title
           FROM disputes d JOIN tasks t ON d.task_id = t.task_id
           WHERE t.creator_id = $1 OR t.assigned_to = $1
           ORDER BY d.opened_at DESC`, [req.userId]))
      }
      return res.status(200).json({ disputes: rows })
    } catch (err) {
      log.error('disputes.list_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /disputes/:id — detail + event log. Admin or a task participant only.
router.get('/:id',
  requireAuth,
  [param('id').isUUID()],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT d.*, t.title AS task_title, t.creator_id, t.assigned_to
         FROM disputes d JOIN tasks t ON d.task_id = t.task_id
         WHERE d.dispute_id = $1`, [req.params.id])
      if (rows.length === 0) return res.status(404).json({ message: 'Dispute not found.' })
      const dispute = rows[0]
      const allowed = req.userRole === 'admin'
        || dispute.creator_id === req.userId || dispute.assigned_to === req.userId
      if (!allowed) return res.status(403).json({ message: 'Not authorized to view this dispute.' })

      const events = await pool.query(
        `SELECT de.*, up.display_name AS actor_name
         FROM dispute_events de LEFT JOIN user_profiles up ON de.actor_id = up.user_id
         WHERE de.dispute_id = $1 ORDER BY de.created_at ASC`, [req.params.id])
      return res.status(200).json({ dispute, events: events.rows })
    } catch (err) {
      log.error('disputes.detail_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /disputes/:id — admin moves the dispute along. Resolution is recorded;
// the actual refund/release executes once escrow exists (MVP-3).
router.patch('/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('status').optional().isIn(['under_review', 'resolved_creator', 'resolved_earner', 'closed']),
    body('admin_notes').optional().trim().isLength({ max: 2000 }),
    body('resolution').optional().isIn(['refund', 'release', 'split']),
  ],
  check,
  async (req, res) => {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin only.' })
    const { status, admin_notes, resolution } = req.body
    if (!status && admin_notes === undefined && !resolution) {
      return res.status(400).json({ message: 'Nothing to update.' })
    }
    const isResolved = status === 'resolved_creator' || status === 'resolved_earner'
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const cur = await client.query(
        `SELECT d.*, t.creator_id, t.assigned_to, t.title
         FROM disputes d JOIN tasks t ON d.task_id = t.task_id
         WHERE d.dispute_id = $1 FOR UPDATE`, [req.params.id])
      if (cur.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Dispute not found.' })
      }

      const sets = ['assigned_admin = $2', 'updated_at = NOW()']
      const vals = [req.params.id, req.userId]
      let i = 3
      if (status)               { sets.push(`status = $${i++}`);      vals.push(status) }
      if (admin_notes !== undefined) { sets.push(`admin_notes = $${i++}`); vals.push(admin_notes) }
      if (resolution)           { sets.push(`resolution = $${i++}`);  vals.push(resolution) }
      if (isResolved)           { sets.push(`resolved_at = NOW()`) }

      const { rows } = await client.query(
        `UPDATE disputes SET ${sets.join(', ')} WHERE dispute_id = $1 RETURNING *`, vals)
      await client.query(
        `INSERT INTO dispute_events (dispute_id, actor_id, action, note)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, req.userId, status ? `status:${status}` : 'updated', admin_notes || resolution || null])
      await client.query('COMMIT')

      // Notify both parties of resolution. NOTE: no funds move yet — settlement
      // is recorded only and executes when escrow lands (MVP-3 / TD-3).
      if (isResolved) {
        for (const uid of [cur.rows[0].creator_id, cur.rows[0].assigned_to]) {
          if (uid) createNotification({
            userId: uid,
            type: 'dispute.resolved',
            title: 'Dispute resolved',
            body: `The dispute on "${cur.rows[0].title}" was resolved.`,
            referenceId: cur.rows[0].task_id,
          })
        }
      }
      return res.status(200).json({ dispute: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('disputes.update_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

export default router
