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

// Resolve one flag for a given viewer. ctx = { role, uid, campusId, now }.
// The order matters: master kill-switch → schedule window → role → campus → %.
// Anonymous / campus-less viewers are excluded from campus- or %-targeted flags
// (we can't place them), but still see fully-on, untargeted flags.
function flagOn(row, ctx) {
  if (!row.enabled) return false
  if (row.enable_at && ctx.now < new Date(row.enable_at).getTime()) return false   // scheduled, not live yet
  if (row.disable_at && ctx.now >= new Date(row.disable_at).getTime()) return false // scheduled kill passed
  if (Array.isArray(row.rollout_roles) && row.rollout_roles.length && !row.rollout_roles.includes(ctx.role)) return false
  if (Array.isArray(row.rollout_campuses) && row.rollout_campuses.length) {
    if (!ctx.campusId || !row.rollout_campuses.includes(ctx.campusId)) return false
  }
  const pct = row.rollout_percent == null ? 100 : row.rollout_percent
  if (pct >= 100) return true
  if (pct <= 0) return false
  if (!ctx.uid) return false
  const bucket = parseInt(crypto.createHash('sha1').update(`${ctx.uid}:${row.flag_key}`).digest('hex').slice(0, 8), 16) % 100
  return bucket < pct
}

// A signed-in viewer's campus = their profile location, resolved up to the campus
// (locations chain is campus → zone). NULL when they have no location set.
async function resolveCampusId(uid) {
  try {
    const { rows } = await pool.query(
      `SELECT CASE WHEN l.kind = 'campus' THEN l.location_id ELSE l.parent_id END AS campus_id
         FROM user_profiles up JOIN locations l ON l.location_id = up.location_id
        WHERE up.user_id = $1`, [uid])
    return rows[0]?.campus_id || null
  } catch { return null }
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
    const { rows } = await pool.query('SELECT flag_key, enabled, rollout_roles, rollout_percent, rollout_campuses, enable_at, disable_at FROM feature_flags')
    // Only pay for the campus lookup when a flag actually targets campuses.
    const needsCampus = uid && rows.some(r => Array.isArray(r.rollout_campuses) && r.rollout_campuses.length)
    const campusId = needsCampus ? await resolveCampusId(uid) : null
    const ctx = { role, uid, campusId, now: Date.now() }
    const flags = {}
    for (const r of rows) flags[r.flag_key] = flagOn(r, ctx)
    return res.status(200).json({ flags })
  } catch (err) {
    log.error('flags.get_failed', { reqId: req.id, msg: err.message })
    // Fail-open with no flags rather than break the app on a flags hiccup.
    return res.status(200).json({ flags: {} })
  }
})

export default router
