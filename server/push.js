// server/push.js — Web Push (H1). Sends notifications to a user's subscribed
// devices via VAPID. Configured only when VAPID_PUBLIC/PRIVATE are set (like the
// other optional providers); otherwise sendPush is a no-op and the app is fine.
import webpush from 'web-push'
import { pool } from './db.js'
import log from './log.js'

export const vapidPublicKey = process.env.VAPID_PUBLIC || ''
const privateKey = process.env.VAPID_PRIVATE || ''
let configured = false
if (vapidPublicKey && privateKey) {
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support.relivr@gmail.com', vapidPublicKey, privateKey)
    configured = true
  } catch (err) { log.error('push.vapid_config', { msg: err.message }) }
}
export function pushConfigured() { return configured }

export async function saveSubscription(userId, sub) {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys = EXCLUDED.keys`,
    [userId, sub.endpoint, JSON.stringify(sub.keys || {})])
}

export async function removeSubscription(endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
}

// Best-effort Web Push to every device a user has. Prunes dead subscriptions
// (404/410). Never throws — a push failure must not break the triggering action.
export async function sendPush(userId, payload) {
  if (!configured) return 0
  let rows = []
  try { ({ rows } = await pool.query('SELECT endpoint, keys FROM push_subscriptions WHERE user_id = $1', [userId])) }
  catch (err) { log.error('push.load_subs', { msg: err.message }); return 0 }
  let sent = 0
  for (const r of rows) {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: r.keys }, JSON.stringify(payload))
      sent++
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [r.endpoint]).catch(() => {})
      } else {
        log.error('push.send', { code: err.statusCode, msg: err.message })
      }
    }
  }
  return sent
}
