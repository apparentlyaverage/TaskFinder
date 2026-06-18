// server/routes/flags.js — public, read-only feature flags (§7.8).
// Returns a { key: enabled } map so the frontend can gate features without a
// deploy. Admin management lives under /admin/flags.
import { Router } from 'express'
import { pool } from '../db.js'
import log from '../log.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT flag_key, enabled FROM feature_flags')
    const flags = Object.fromEntries(rows.map(r => [r.flag_key, r.enabled]))
    return res.status(200).json({ flags })
  } catch (err) {
    log.error('flags.get_failed', { reqId: req.id, msg: err.message })
    // Fail-open with no flags rather than break the app on a flags hiccup.
    return res.status(200).json({ flags: {} })
  }
})

export default router
