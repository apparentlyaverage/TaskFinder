// server/routes/admin.js — platform monitoring for admins (§7.8).
// All routes are admin-only. Read-only overviews built from existing tables.
import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth, requireAdmin } from '../middleware.js'

const router = Router()
router.use(requireAuth, requireAdmin)

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /admin/stats — platform overview.
router.get('/stats', async (req, res) => {
  try {
    const [users, tasks, bids, disputes, businesses] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
                         COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted
                    FROM users`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM tasks GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int AS total FROM bids`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM disputes GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'active')::int AS active FROM businesses`),
    ])
    const tasksByStatus = Object.fromEntries(tasks.rows.map(r => [r.status, r.count]))
    const totalTasks = tasks.rows.reduce((s, r) => s + r.count, 0)
    const completed = tasksByStatus.completed || 0
    return res.status(200).json({
      users: users.rows[0],
      tasks: { total: totalTasks, by_status: tasksByStatus },
      bids: bids.rows[0],
      disputes: { by_status: Object.fromEntries(disputes.rows.map(r => [r.status, r.count])) },
      businesses: businesses.rows[0],
      completion_rate: totalTasks ? Math.round((completed / totalTasks) * 100) : null,
    })
  } catch (err) {
    log.error('admin.stats_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /admin/activity — recent platform activity (append-only audit feed).
router.get('/activity',
  [query('limit').optional().isInt({ min: 1, max: 100 }), query('offset').optional().isInt({ min: 0 })],
  check,
  async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50
    const offset = parseInt(req.query.offset, 10) || 0
    try {
      const { rows } = await pool.query(
        `SELECT a.activity_id, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id,
                a.metadata, a.created_at, up.display_name AS actor_name
           FROM activity_logs a
           LEFT JOIN user_profiles up ON a.actor_id = up.user_id
          ORDER BY a.created_at DESC
          LIMIT $1 OFFSET $2`, [limit, offset])
      return res.status(200).json({ activity: rows })
    } catch (err) {
      log.error('admin.activity_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /admin/users — paginated, searchable user list for moderation.
router.get('/users',
  [query('q').optional().trim(), query('limit').optional().isInt({ min: 1, max: 100 }), query('offset').optional().isInt({ min: 0 })],
  check,
  async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 25
    const offset = parseInt(req.query.offset, 10) || 0
    const q = req.query.q
    try {
      const params = []
      let where = ''
      if (q) { params.push(`%${q}%`); where = `WHERE (u.email ILIKE $1 OR up.display_name ILIKE $1)` }
      params.push(limit, offset)
      const { rows } = await pool.query(
        `SELECT u.user_id, u.email, u.role, u.is_email_verified, u.created_at, u.deleted_at, u.suspended_at,
                up.display_name, up.avg_rating, up.rating_count,
                (SELECT COUNT(*) FROM tasks t WHERE t.creator_id = u.user_id)::int AS tasks_posted
           FROM users u LEFT JOIN user_profiles up ON u.user_id = up.user_id
           ${where}
          ORDER BY u.created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
      return res.status(200).json({ users: rows })
    } catch (err) {
      log.error('admin.users_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// PATCH /admin/users/:id — suspend/unsuspend and/or change role.
// Suspending bumps token_version so the user's active sessions die immediately.
router.patch('/users/:id',
  [
    param('id').isUUID(),
    body('suspended').optional().isBoolean(),
    body('role').optional().isIn(['member', 'creator', 'earner', 'admin']),
  ],
  check,
  async (req, res) => {
    const { suspended, role } = req.body
    if (req.params.id === req.userId) {
      return res.status(400).json({ message: "You can't moderate your own account." })
    }
    if (suspended === undefined && role === undefined) {
      return res.status(400).json({ message: 'Nothing to update.' })
    }
    const sets = ['token_version = token_version + 1', 'updated_at = NOW()']
    const vals = [req.params.id]
    let i = 2
    if (suspended !== undefined) { sets.push(`suspended_at = ${suspended ? 'NOW()' : 'NULL'}`) }
    if (role !== undefined) { sets.push(`role = $${i++}`); vals.push(role) }
    try {
      const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE user_id = $1 AND deleted_at IS NULL
         RETURNING user_id, email, role, suspended_at`, vals)
      if (rows.length === 0) return res.status(404).json({ message: 'User not found.' })
      log.info('admin.user_moderated', { reqId: req.id, adminId: req.userId, target: req.params.id, suspended, role })
      return res.status(200).json({ user: rows[0] })
    } catch (err) {
      log.error('admin.moderate_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
