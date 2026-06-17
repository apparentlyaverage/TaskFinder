// server/routes/categories.js — public, read-only marketplace categories.
// Drives the browse filter chips + the post-task picker so categories are a
// data change, not a redeploy. Mirrors routes/locations.js.
import { Router } from 'express'
import { pool } from '../db.js'
import log from '../log.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT category_id, name, icon, gradient_from, gradient_to, keywords
         FROM categories
        WHERE is_active = TRUE
        ORDER BY sort_order, name`)
    return res.status(200).json({ categories: rows })
  } catch (err) {
    log.error('categories.get_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
