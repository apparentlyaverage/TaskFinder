// server/routes/locations.js — public, read-only location taxonomy.
// Drives the campus/zone picker on the frontend so expansion to a new campus is
// a data change (INSERT into `locations`), never a redeploy. No auth: the list
// is non-sensitive and needed before a user signs up.
import { Router } from 'express'
import { pool } from '../db.js'
import log from '../log.js'

const router = Router()

// GET /locations — active locations grouped as campuses → zones.
// Optional ?kind=campus|zone|region returns a flat filtered list instead.
router.get('/', async (req, res) => {
  const { kind } = req.query
  try {
    if (kind) {
      const { rows } = await pool.query(
        `SELECT location_id, name, kind, parent_id
           FROM locations
          WHERE is_active = TRUE AND kind = $1
          ORDER BY sort_order, name`,
        [kind])
      return res.status(200).json({ locations: rows })
    }

    const { rows } = await pool.query(
      `SELECT location_id, name, kind, parent_id, sort_order
         FROM locations
        WHERE is_active = TRUE
        ORDER BY sort_order, name`)

    // Nest zones under their campus; surface regions/campuses at the top level.
    const byId = new Map(rows.map(r => [r.location_id, { ...r, zones: [] }]))
    const campuses = []
    for (const node of byId.values()) {
      if (node.kind === 'zone' && node.parent_id && byId.has(node.parent_id)) {
        byId.get(node.parent_id).zones.push({ location_id: node.location_id, name: node.name })
      } else if (node.kind !== 'zone') {
        campuses.push(node)
      }
    }
    return res.status(200).json({ campuses })
  } catch (err) {
    log.error('locations.get_failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
