// server/jobs.js — background jobs for the monolith.
// Replaces the retired services/jobs scheduler. Kept as plain exported
// functions so they're unit-testable and can be triggered by an interval
// (index.js) or an admin/cron endpoint.
import { pool } from './db.js'
import log from './log.js'
import { sendEmail } from './email.js'

// Move open tasks whose deadline has passed to 'expired'. In-progress / disputed
// / completed tasks are left alone — only un-awarded work expires.
export async function expireDueTasks(db = pool) {
  const { rows } = await db.query(
    `UPDATE tasks
        SET status = 'expired', updated_at = NOW()
      WHERE status = 'open' AND deadline < NOW()
      RETURNING task_id`
  )
  if (rows.length) log.info('jobs.tasks_expired', { count: rows.length })
  return rows.length
}

// Email a batched digest to 'daily' users who have new notifications since their
// last digest. The ≥20h gate enforces a roughly-daily cadence regardless of how
// often this runs, so the scheduler can tick more frequently safely.
export async function sendDigests(db = pool) {
  const { rows: users } = await db.query(
    `SELECT user_id, email, last_digest_at
       FROM users
      WHERE email_frequency = 'daily' AND deleted_at IS NULL AND email IS NOT NULL
        AND (last_digest_at IS NULL OR last_digest_at < NOW() - INTERVAL '20 hours')`)
  let sent = 0
  for (const u of users) {
    const { rows: notes } = await db.query(
      `SELECT title, body, created_at FROM notifications
        WHERE user_id = $1 AND created_at > COALESCE($2, NOW() - INTERVAL '7 days')
        ORDER BY created_at DESC LIMIT 25`, [u.user_id, u.last_digest_at])
    if (notes.length === 0) continue
    const lines = notes.map(n => `• ${n.title} — ${n.body}`).join('\n')
    await sendEmail({
      to: u.email,
      subject: `Your ReLivR digest — ${notes.length} update${notes.length === 1 ? '' : 's'}`,
      text: `Here's what's new on ReLivR:\n\n${lines}\n\n— ReLivR\nChange your email cadence in Profile → Security.`,
    })
    await db.query('UPDATE users SET last_digest_at = NOW() WHERE user_id = $1', [u.user_id])
    sent++
  }
  if (sent) log.info('jobs.digests_sent', { count: sent })
  return sent
}

// Start the periodic scheduler. Called from index.js (never from app.js, so
// tests don't spawn timers). Runs once on boot, then on intervals.
export function startScheduler({ expiryMs = 5 * 60 * 1000, digestMs = 60 * 60 * 1000 } = {}) {
  const runExpiry = () => expireDueTasks().catch(err => log.error('jobs.expire_failed', { msg: err.message }))
  const runDigest = () => sendDigests().catch(err => log.error('jobs.digest_failed', { msg: err.message }))
  runExpiry(); runDigest()
  const handles = [setInterval(runExpiry, expiryMs), setInterval(runDigest, digestMs)]
  handles.forEach(h => h.unref?.()) // don't keep the process alive just for timers
  return handles
}
