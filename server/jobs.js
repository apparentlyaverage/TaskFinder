// server/jobs.js — background jobs for the monolith.
// Replaces the retired services/jobs scheduler. Kept as plain exported
// functions so they're unit-testable and can be triggered by an interval
// (index.js) or an admin/cron endpoint.
import { pool } from './db.js'
import log from './log.js'
import { sendEmail, EMAIL_FROM_UPDATES } from './email.js'

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

// Re-activate expired recurring deals for another cycle (§7.11.2). Refresh-in-
// place: new window = active_window_s (captured at create) or, if null, the
// recurrence interval. Stops at recurrence_until. Runs AFTER expireDeals each
// tick, so a just-expired recurring deal comes straight back with minimal gap.
export async function refreshRecurringDeals(db = pool) {
  const { rows } = await db.query(
    `UPDATE campus_deals
        SET status = 'active',
            starts_at = NOW(),
            expires_at = NOW() + COALESCE(
              make_interval(secs => active_window_s),
              CASE recurrence
                WHEN 'daily'   THEN INTERVAL '1 day'
                WHEN 'weekly'  THEN INTERVAL '7 days'
                WHEN 'monthly' THEN INTERVAL '1 month'
              END),
            updated_at = NOW()
      WHERE status = 'expired'
        AND recurrence <> 'none'
        AND (recurrence_until IS NULL OR NOW() < recurrence_until)
      RETURNING deal_id`
  )
  if (rows.length) log.info('jobs.deals_refreshed', { count: rows.length })
  return rows.length
}

// Mark lapsed Campus Deals 'expired'. HOUSEKEEPING ONLY — the public Deals query
// already hides anything past expires_at via `WHERE status='active' AND
// expires_at > NOW()`, so correctness never depends on this running. This just
// keeps `status` truthful for owner dashboards/analytics.
export async function expireDeals(db = pool) {
  const { rows } = await db.query(
    `UPDATE campus_deals
        SET status = 'expired', updated_at = NOW()
      WHERE status = 'active' AND expires_at <= NOW()
      RETURNING deal_id`
  )
  if (rows.length) log.info('jobs.deals_expired', { count: rows.length })
  return rows.length
}

// Archive tasks that have outlived their usefulness (§7.11.2). HOUSEKEEPING +
// retention — default feeds already filter `archived_at IS NULL`, so this stamps
// the timestamp rather than being the sole gate. Two triggers: a hard TTL
// (expires_at passed), or a terminal task older than the retention window.
export async function archiveExpiredTasks(db = pool, { retentionDays = 90 } = {}) {
  const { rows } = await db.query(
    `UPDATE tasks
        SET archived_at = NOW()
      WHERE archived_at IS NULL
        AND ( (expires_at IS NOT NULL AND expires_at < NOW())
              OR (status IN ('completed','cancelled','expired')
                  AND updated_at < NOW() - ($1 || ' days')::interval) )
      RETURNING task_id`,
    [retentionDays])
  if (rows.length) log.info('jobs.tasks_archived', { count: rows.length })
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
      from: EMAIL_FROM_UPDATES,
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

// Remind both parties about bookings starting within the next hour (§D3). In-app
// notifications inserted directly (db-injectable + testable, like sendRecurring);
// reminded_at guards against duplicate reminders across ticks.
export async function sendBookingReminders(db = pool) {
  const { rows } = await db.query(
    `SELECT bk.booking_id, bk.guest_id, s.host_type, s.host_id, s.starts_at
       FROM bookings bk JOIN availability_slots s ON s.slot_id = bk.slot_id
      WHERE bk.status = 'booked' AND bk.reminded_at IS NULL
        AND s.starts_at > NOW() AND s.starts_at <= NOW() + INTERVAL '1 hour'`)
  let sent = 0
  for (const r of rows) {
    const when = new Date(r.starts_at).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
    const targets = [r.guest_id]
    if (r.host_type === 'business') {
      const o = await db.query('SELECT owner_id FROM businesses WHERE business_id = $1', [r.host_id])
      if (o.rows[0]?.owner_id) targets.push(o.rows[0].owner_id)
    } else {
      targets.push(r.host_id)
    }
    for (const uid of targets) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body, reference_id)
         VALUES ($1, 'booking.reminder', 'Upcoming booking', $2, $3)`,
        [uid, `You have a booking soon — ${when}.`, r.host_id])
    }
    await db.query('UPDATE bookings SET reminded_at = NOW() WHERE booking_id = $1', [r.booking_id])
    sent++
  }
  if (sent) log.info('jobs.booking_reminders', { count: sent })
  return sent
}

// F2: warn a business's followers when one of its deals is within 24h of expiring.
// Guarded by expiring_notified_at so each deal alerts once.
export async function notifyExpiringDeals(db = pool) {
  const { rows } = await db.query(
    `SELECT d.deal_id, d.title, d.business_id, b.name AS business_name
       FROM campus_deals d JOIN businesses b ON b.business_id = d.business_id
      WHERE d.status = 'active' AND d.expiring_notified_at IS NULL
        AND d.expires_at > NOW() AND d.expires_at <= NOW() + INTERVAL '24 hours'`)
  let notified = 0
  for (const d of rows) {
    const fols = await db.query("SELECT follower_id FROM follows WHERE target_type = 'business' AND target_id = $1", [d.business_id])
    for (const f of fols.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, body, reference_id)
         VALUES ($1, 'deal.expiring', 'Deal ending soon', $2, $3)`,
        [f.follower_id, `${d.business_name}'s deal "${d.title}" ends within 24 hours.`, d.deal_id])
    }
    await db.query('UPDATE campus_deals SET expiring_notified_at = NOW() WHERE deal_id = $1', [d.deal_id])
    notified++
  }
  if (notified) log.info('jobs.deals_expiring_notified', { count: notified })
  return notified
}

// F1b: spawn one retainer cycle's task — pre-assigned to the provider, with the
// agreed rate recorded (C2 source of truth). Shared by the route + the runner.
export async function spawnRetainerTask(db, r) {
  const deadline = new Date(Date.now() + 7 * 86400000)
  const { rows } = await db.query(
    `INSERT INTO tasks (creator_id, title, description, budget, deadline, status, assigned_to, agreed_amount)
     VALUES ($1,$2,$3,$4,$5,'in_progress',$6,$7) RETURNING task_id`,
    [r.client_id, r.title, r.description || r.title, r.amount, deadline, r.provider_id, r.amount])
  const taskId = rows[0].task_id
  await db.query(
    `INSERT INTO notifications (user_id, type, title, body, reference_id)
     VALUES ($1, 'retainer.task', 'New retainer task', $2, $3)`,
    [r.provider_id, `Your retainer "${r.title}" has a new task ready.`, taskId])
  return taskId
}

// F1b: spawn tasks for due retainers, then advance next_run_at by the cadence.
export async function runRetainers(db = pool) {
  const { rows } = await db.query('SELECT * FROM retainers WHERE active AND next_run_at <= NOW()')
  let spawned = 0
  for (const r of rows) {
    await spawnRetainerTask(db, r)
    await db.query(
      `UPDATE retainers SET next_run_at = NOW() + (CASE cadence WHEN 'weekly' THEN INTERVAL '7 days' ELSE INTERVAL '1 month' END)
        WHERE retainer_id = $1`, [r.retainer_id])
    spawned++
  }
  if (spawned) log.info('jobs.retainers_spawned', { count: spawned })
  return spawned
}

// Start the periodic scheduler. Called from index.js (never from app.js, so
// tests don't spawn timers). Runs once on boot, then on intervals.
export function startScheduler({ expiryMs = 5 * 60 * 1000, digestMs = 60 * 60 * 1000, recurringMs = 60 * 60 * 1000 } = {}) {
  const runExpiry = async () => {
    await expireDueTasks().catch(err => log.error('jobs.expire_failed', { msg: err.message }))
    // expire first, then refresh — a just-expired recurring deal comes straight back.
    await expireDeals().catch(err => log.error('jobs.deals_expire_failed', { msg: err.message }))
    await refreshRecurringDeals().catch(err => log.error('jobs.deals_refresh_failed', { msg: err.message }))
    archiveExpiredTasks().catch(err => log.error('jobs.archive_failed', { msg: err.message }))
    sendBookingReminders().catch(err => log.error('jobs.booking_reminders_failed', { msg: err.message }))
    notifyExpiringDeals().catch(err => log.error('jobs.deals_expiring_failed', { msg: err.message }))
  }
  const runDigest = () => sendDigests().catch(err => log.error('jobs.digest_failed', { msg: err.message }))
  const runRecurring = async () => {
    await sendRecurring().catch(err => log.error('jobs.recurring_failed', { msg: err.message }))
    await runRetainers().catch(err => log.error('jobs.retainers_failed', { msg: err.message }))
  }
  runExpiry(); runDigest(); runRecurring()
  const handles = [
    setInterval(runExpiry, expiryMs),
    setInterval(runDigest, digestMs),
    setInterval(runRecurring, recurringMs),
  ]
  handles.forEach(h => h.unref?.()) // don't keep the process alive just for timers
  return handles
}
