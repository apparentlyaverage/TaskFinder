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

// Spawn tasks for recurring templates whose next_run_at has passed, then
// advance next_run_at by the recurrence interval. Notifies the owner inline
// (same db handle) so the whole job is testable with one injected connection.
export async function sendRecurring(db = pool) {
  const { rows } = await db.query(
    `SELECT * FROM task_templates
      WHERE is_active AND recurrence <> 'none' AND next_run_at IS NOT NULL AND next_run_at <= NOW()`)
  let spawned = 0
  for (const t of rows) {
    const deadline = new Date(Date.now() + t.deadline_days * 86400000)
    const { rows: taskRows } = await db.query(
      `INSERT INTO tasks (creator_id, title, description, budget, deadline, skill_tags, campus_zone)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING task_id`,
      [t.user_id, t.title, t.description, t.budget, deadline, t.skill_tags, t.campus_zone])
    await db.query(
      `UPDATE task_templates SET next_run_at = NOW() + (CASE recurrence
          WHEN 'daily' THEN INTERVAL '1 day'
          WHEN 'weekly' THEN INTERVAL '7 days'
          WHEN 'monthly' THEN INTERVAL '1 month' END)
        WHERE template_id = $1`, [t.template_id])
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_id)
       VALUES ($1, 'task.recurring_created', 'Recurring task posted', $2, $3)`,
      [t.user_id, `Your recurring task "${t.title}" was posted.`, taskRows[0].task_id])
    spawned++
  }
  if (spawned) log.info('jobs.recurring_spawned', { count: spawned })
  return spawned
}

// Start the periodic scheduler. Called from index.js (never from app.js, so
// tests don't spawn timers). Runs once on boot, then on intervals.
export function startScheduler({ expiryMs = 5 * 60 * 1000, digestMs = 60 * 60 * 1000, recurringMs = 60 * 60 * 1000 } = {}) {
  const runExpiry = () => expireDueTasks().catch(err => log.error('jobs.expire_failed', { msg: err.message }))
  const runDigest = () => sendDigests().catch(err => log.error('jobs.digest_failed', { msg: err.message }))
  const runRecurring = () => sendRecurring().catch(err => log.error('jobs.recurring_failed', { msg: err.message }))
  runExpiry(); runDigest(); runRecurring()
  const handles = [
    setInterval(runExpiry, expiryMs),
    setInterval(runDigest, digestMs),
    setInterval(runRecurring, recurringMs),
  ]
  handles.forEach(h => h.unref?.()) // don't keep the process alive just for timers
  return handles
}
