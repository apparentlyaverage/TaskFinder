// server/audit.js — the single chokepoint for god-mode admin actions.
//
// Every privileged admin mutation calls writeAudit() so there is a complete,
// append-only trail in activity_logs (who did what to which entity, with a
// before/after snapshot and an optional reason). Reusing the existing
// activity_logs table (migration 18) — before/after/reason ride in its JSONB
// `metadata` column, so no schema change is needed.
//
// Best-effort: an audit-write failure must never block the action it records,
// but we log the failure loudly — a silent audit gap is itself a security issue.
import { pool } from './db.js'
import log from './log.js'

export async function writeAudit({ actorId, actorRole, action, entityType, entityId, before = null, after = null, reason = null, reqId } = {}) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_id, actor_role, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId || null, actorRole || null, action, entityType || null, entityId || null,
       JSON.stringify({ before, after, reason })]
    )
  } catch (err) {
    log.error('audit.write_failed', { reqId, action, entityType, entityId, msg: err.message })
  }
}
