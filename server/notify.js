// server/notify.js
// Creates an in-app notification AND (best-effort) emails the recipient.
// Replaces the RabbitMQ event bus. Failures are non-fatal — a missed
// notification or email must never break the main transaction.
import { pool } from './db.js'
import log from './log.js'
import { sendEmail, EMAIL_FROM_UPDATES } from './email.js'
import { sendPush } from './push.js'

export async function createNotification({ userId, type, title, body, referenceId = null }) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, reference_id) VALUES ($1,$2,$3,$4,$5)',
      [userId, type, title, body, referenceId]
    )
  } catch (err) {
    log.error('notify.create_failed', { msg: err.message })
    return
  }
  // Fire-and-forget activity email — respects the user's opt-out.
  sendActivityEmail({ userId, title, body }).catch(() => {})
  // Fire-and-forget Web Push — no-op unless the user has a subscription and
  // VAPID is configured. tag=type so repeat notifications collapse per device.
  sendPush(userId, { title, body, url: '/', tag: type }).catch(() => {})
}

// Instant activity email — only for users on the 'instant' cadence. 'daily'
// users are batched by the digest job; 'off' users get nothing. Skips deleted
// and address-less users.
async function sendActivityEmail({ userId, title, body }) {
  const { rows } = await pool.query(
    'SELECT email, email_frequency FROM users WHERE user_id = $1 AND deleted_at IS NULL', [userId])
  const u = rows[0]
  if (!u || !u.email || u.email_frequency !== 'instant' || u.email.endsWith('@deleted.local')) return
  await sendEmail({
    to: u.email,
    subject: title,
    text: `${body}\n\n— ReLivR\nChange how often you get these in Profile → Security.`,
    from: EMAIL_FROM_UPDATES,
  })
}
