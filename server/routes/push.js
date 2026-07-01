// server/routes/push.js — Web Push subscribe/unsubscribe + the public VAPID key
// the client needs to subscribe (H1).
import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import log from '../log.js'
import { requireAuth } from '../middleware.js'
import { vapidPublicKey, pushConfigured, saveSubscription, removeSubscription } from '../push.js'

const router = Router()
function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /push/public-key — the VAPID public key + whether push is configured.
router.get('/public-key', (req, res) => res.status(200).json({ publicKey: vapidPublicKey, enabled: pushConfigured() }))

// POST /push/subscribe — store this browser's PushSubscription for the user.
router.post('/subscribe', requireAuth,
  [body('endpoint').isURL({ require_tld: false }), body('keys').isObject()],
  check,
  async (req, res) => {
    try {
      await saveSubscription(req.userId, { endpoint: req.body.endpoint, keys: req.body.keys })
      return res.status(201).json({ ok: true })
    } catch (err) {
      log.error('POST /push/subscribe', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// POST /push/unsubscribe — drop a subscription (e.g. the user turned notifications off).
router.post('/unsubscribe', requireAuth, [body('endpoint').isString().notEmpty()], check,
  async (req, res) => {
    try {
      await removeSubscription(req.body.endpoint)
      return res.status(200).json({ ok: true })
    } catch (err) {
      log.error('POST /push/unsubscribe', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
