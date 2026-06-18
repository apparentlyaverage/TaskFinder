// server/routes/templates.js — reusable + recurring task templates (§7.5).
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// Next scheduled run for a recurrence, from now. null for 'none'.
export function nextRun(recurrence, from = new Date()) {
  const d = new Date(from)
  if (recurrence === 'daily')   { d.setDate(d.getDate() + 1); return d }
  if (recurrence === 'weekly')  { d.setDate(d.getDate() + 7); return d }
  if (recurrence === 'monthly') { d.setMonth(d.getMonth() + 1); return d }
  return null
}

// POST /templates — save a template (optionally recurring).
router.post('/',
  requireAuth,
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').trim().notEmpty(),
    body('budget').isFloat({ gt: 0 }),
    body('deadlineDays').optional().isInt({ gt: 0 }),
    body('skill_tags').optional().isArray(),
    body('campus_zone').optional({ nullable: true }).trim(),
    body('recurrence').optional().isIn(['none', 'daily', 'weekly', 'monthly']),
  ],
  check,
  async (req, res) => {
    const { title, description, budget, deadlineDays = 7, skill_tags = [], campus_zone = null, recurrence = 'none' } = req.body
    try {
      const { rows } = await pool.query(
        `INSERT INTO task_templates
           (user_id, title, description, budget, deadline_days, skill_tags, campus_zone, recurrence, next_run_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.userId, title, description, budget, deadlineDays, skill_tags, campus_zone, recurrence, nextRun(recurrence)])
      return res.status(201).json({ template: rows[0] })
    } catch (err) {
      log.error('templates.create_failed', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /templates — my active templates.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM task_templates WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [req.userId])
    return res.status(200).json({ templates: rows })
  } catch (err) {
    log.error('templates.list_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// DELETE /templates/:id — remove one of my templates.
router.delete('/:id', requireAuth, [param('id').isUUID()], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM task_templates WHERE template_id = $1 AND user_id = $2 RETURNING template_id',
      [req.params.id, req.userId])
    if (rows.length === 0) return res.status(404).json({ message: 'Template not found.' })
    return res.status(200).json({ message: 'Template deleted.' })
  } catch (err) {
    log.error('templates.delete_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /templates/:id/use — spawn a task now from the template.
router.post('/:id/use', requireAuth, [param('id').isUUID()], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM task_templates WHERE template_id = $1 AND user_id = $2', [req.params.id, req.userId])
    if (rows.length === 0) return res.status(404).json({ message: 'Template not found.' })
    const t = rows[0]
    const deadline = new Date(Date.now() + t.deadline_days * 86400000)
    const task = await pool.query(
      `INSERT INTO tasks (creator_id, title, description, budget, deadline, skill_tags, campus_zone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.userId, t.title, t.description, t.budget, deadline, t.skill_tags, t.campus_zone])
    return res.status(201).json({ task: task.rows[0] })
  } catch (err) {
    log.error('templates.use_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
