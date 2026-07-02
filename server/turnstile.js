// server/turnstile.js — Cloudflare Turnstile bot verification (landing hardening).
// Optional provider, same pattern as Gmail/VAPID/Cloudinary: no TURNSTILE_SECRET
// → middleware is a pass-through no-op, so nothing breaks until keys are set.
// When configured, the client must send a `turnstileToken` which we verify with
// Cloudflare before the handler runs. Fail-closed when configured (a bot-check
// outage on these low-stakes forms just means "try again"), but network errors
// are logged loudly so an outage is visible.
import log from './log.js'

const SECRET = process.env.TURNSTILE_SECRET || ''
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function turnstileConfigured() { return Boolean(SECRET) }

// Express middleware: verifies req.body.turnstileToken when the secret is set.
export async function requireHuman(req, res, next) {
  if (!SECRET) return next() // not configured — open (rate limits still apply)
  const token = req.body?.turnstileToken
  if (!token || typeof token !== 'string') {
    return res.status(403).json({ message: 'Bot check failed — please refresh and try again.' })
  }
  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, response: token, remoteip: req.ip }),
    })
    const data = await r.json()
    if (!data.success) {
      log.info('turnstile.rejected', { reqId: req.id, codes: data['error-codes'] })
      return res.status(403).json({ message: 'Bot check failed — please refresh and try again.' })
    }
    return next()
  } catch (err) {
    log.error('turnstile.verify_error', { reqId: req.id, msg: err.message })
    return res.status(403).json({ message: 'Bot check unavailable — please try again shortly.' })
  }
}
