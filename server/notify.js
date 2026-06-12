// server/notify.js
// Replaces the RabbitMQ event bus. Routes call this directly after the
// action that triggers a notification. Failures are non-fatal — a missed
// notification must never break the main transaction.
import { pool } from './db.js'

export async function createNotification({ userId, type, title, body, referenceId = null }) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, body, reference_id) VALUES ($1,$2,$3,$4,$5)',
      [userId, type, title, body, referenceId]
    )
  } catch (err) {
    console.error('[notify]', err.message)
  }
}
