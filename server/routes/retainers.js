// server/routes/retainers.js — recurring engagements ("retainers", F1b).
//
// A client sets up a standing arrangement with a provider; on each cadence the
// jobs.runRetainers runner spawns a task pre-assigned to the provider. The first
// task is created immediately on setup so it's instantly useful. Payment
// automation arrives with escrow (G1); until then the pair settle as they do for
// any task today.
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'
import { createNotification } from '../notify.js'
import { spawnRetainerTask } from '../jobs.js'

const router = Router()
router.use(requireAuth)

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// POST /retainers — set up a recurring engagement with a provider.
router.post('/',
  [
    body('providerId').isUUID(),
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('amount').isFloat({ gt: 0 }),
    body('cadence').isIn(['weekly', 'monthly']),
  ],
  check,
  async (req, res) => {
    const { providerId, title, amount, cadence } = req.body
    const description = (req.body.description || '').toString().trim() || null
    if (providerId === req.userId) return res.status(400).json({ message: "You can't set up a retainer with yourself." })
    try {
      const prov = await pool.query('SELECT user_id FROM users WHERE user_id = $1 AND deleted_at IS NULL', [providerId])
      if (prov.rows.length === 0) return res.status(404).json({ message: 'That provider no longer exists.' })
      const { rows } = await pool.query(
        `INSERT INTO retainers (client_id, provider_id, title, description, amount, cadence, next_run_at)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() + (CASE $6 WHEN 'weekly' THEN INTERVAL '7 days' ELSE INTERVAL '1 month' END))
         RETURNING *`,
        [req.userId, providerId, title, description, amount, cadence])
      const r = rows[0]
      await spawnRetainerTask(pool, r) // first task now; the runner handles future cycles
      createNotification({ userId: providerId, type: 'retainer.started', title: 'New retainer', body: `Someone set up a ${cadence} retainer with you: "${title}".`, referenceId: r.retainer_id }).catch(() => {})
      return res.status(201).json({ retainer: r })
    } catch (err) {
      log.error('POST /retainers', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /retainers/mine — the ones I set up (as the client).
router.get('/mine', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, up.display_name AS provider_name
         FROM retainers r LEFT JOIN user_profiles up ON up.user_id = r.provider_id
        WHERE r.client_id = $1 ORDER BY r.active DESC, r.created_at DESC`, [req.userId])
    return res.status(200).json({ retainers: rows })
  } catch (err) {
    log.error('GET /retainers/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /retainers/incoming — the ones where I'm the provider.
router.get('/incoming', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, up.display_name AS client_name
         FROM retainers r LEFT JOIN user_profiles up ON up.user_id = r.client_id
        WHERE r.provider_id = $1 AND r.active ORDER BY r.created_at DESC`, [req.userId])
    return res.status(200).json({ retainers: rows })
  } catch (err) {
    log.error('GET /retainers/incoming', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /retainers/:id/cancel — either party ends the arrangement.
router.post('/:id/cancel', [param('id').isUUID()], check, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT client_id, provider_id FROM retainers WHERE retainer_id = $1', [req.params.id])
    const r = rows[0]
    if (!r) return res.status(404).json({ message: 'Retainer not found.' })
    if (r.client_id !== req.userId && r.provider_id !== req.userId) return res.status(403).json({ message: 'Not your retainer.' })
    await pool.query('UPDATE retainers SET active = FALSE WHERE retainer_id = $1', [req.params.id])
    const other = r.client_id === req.userId ? r.provider_id : r.client_id
    createNotification({ userId: other, type: 'retainer.cancelled', title: 'Retainer ended', body: 'A recurring retainer was cancelled.', referenceId: req.params.id }).catch(() => {})
    return res.status(200).json({ message: 'Retainer cancelled.' })
  } catch (err) {
    log.error('POST /retainers/:id/cancel', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
