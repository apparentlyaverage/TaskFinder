// server/routes/flags.js — public, read-only feature flags (§7.8, expanded H2).
// Returns a { key: enabled } map RESOLVED FOR THE REQUESTER so the frontend can
// gate features without a deploy. Flags can target roles + a % rollout; the master
// kill-switch is `enabled`. Admin management lives under /admin/flags.
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { pool } from '../db.js'
import log from '../log.js'

const router = Router()

// Resolve one flag for a given viewer (role + stable id for % bucketing).
// Anonymous viewers (no uid) only get fully-on, role-unrestricted flags — partial
// rollouts stay off until they sign in, since we can't bucket them stably.
function flagOn(row, role, uid) {
  if (!row.enabled) return false
  if (Array.isArray(row.rollout_roles) && row.rollout_roles.length && !row.rollout_roles.includes(role)) return false
  const pct = row.rollout_percent == null ? 100 : row.rollout_percent
  if (pct >= 100) return true
  if (pct <= 0) return false
  if (!uid) return false
  const bucket = parseInt(crypto.createHash('sha1').update(`${uid}:${row.flag_key}`).digest('hex').slice(0, 8), 16) % 100
  return bucket < pct
}

router.get('/', async (req, res) => {
  // Optional auth — the token (if any) gives us the role + a stable id to evaluate
  // targeted flags. No/!invalid token → anonymous (role-unrestricted, 100% flags only).
  let role = null, uid = null
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    try { const p = jwt.verify(auth.slice(7), process.env.JWT_SECRET); role = p.role || null; uid = p.userId || null } catch { /* anonymous */ }
  }
  try {
    const { rows } = await pool.query('SELECT flag_key, enabled, rollout_roles, rollout_percent FROM feature_flags')
    const flags = {}
    for (const r of rows) flags[r.flag_key] = flagOn(r, role, uid)
    return res.status(200).json({ flags })
  } catch (err) {
    log.error('flags.get_failed', { reqId: req.id, msg: err.message })
    // Fail-open with no flags rather than break the app on a flags hiccup.
    return res.status(200).json({ flags: {} })
  }
})

export default router
