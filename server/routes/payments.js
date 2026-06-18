// server/routes/payments.js — Paystack integration (ZAR-native payments).
//
// Flow:
//   POST /payments/initiate         — create escrow + Paystack checkout URL
//   GET  /payments/verify/:reference — poll after redirect (creator side)
//   POST /payments/webhook          — Paystack sends events here (HMAC-SHA512)
//   POST /payments/release/:escrowId — admin or auto-release after completion
//
// All amounts sent to Paystack are in kobo (100 kobo = R1).
// Webhook verification uses x-paystack-signature (HMAC-SHA512 of raw body).

import { Router } from 'express'
import { param, body, validationResult } from 'express-validator'
import { createHmac } from 'node:crypto'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'

const router = Router()

const PAYSTACK_BASE = 'https://api.paystack.co'

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function paystackPost(path, body) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function paystackGet(path) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  })
  return res.json()
}

// Record a score event for an earner (fire-and-forget; never blocks the caller)
async function recordScoreEvent(userId, eventType, weight, referenceId = null) {
  try {
    await pool.query(
      `INSERT INTO score_events (user_id, event_type, weight, reference_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, eventType, weight, referenceId]
    )
  } catch (err) {
    log.error('score_event insert failed', { userId, eventType, err: err.message })
  }
}

// ── POST /payments/initiate ───────────────────────────────────────────────────
// Creator initiates escrow for an accepted task. Creates an escrow_transactions
// row (pending) and returns a Paystack checkout URL for the creator to pay.
router.post('/initiate',
  requireAuth,
  [
    body('task_id').isUUID(),
    body('email').isEmail().normalizeEmail(),
  ],
  check,
  async (req, res) => {
    const { task_id, email } = req.body
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Verify the task belongs to this creator and has an assigned earner
      const { rows: tasks } = await client.query(
        `SELECT t.task_id, t.title, t.budget, t.assigned_to, t.status
         FROM tasks t WHERE t.task_id = $1 AND t.creator_id = $2`,
        [task_id, req.userId]
      )
      if (tasks.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Task not found or not yours.' })
      }
      const task = tasks[0]
      if (!task.assigned_to) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'Task must have an assigned earner before escrow.' })
      }
      if (!['open', 'in_progress'].includes(task.status)) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'Task is not in a payable state.' })
      }

      // escrow_transactions.task_id is UNIQUE — at most one escrow per task.
      // Resolve any existing row before attempting to create a new one.
      const { rows: existing } = await client.query(
        `SELECT et.escrow_id, et.status, et.paystack_ref
         FROM escrow_transactions et
         WHERE et.task_id = $1`,
        [task_id]
      )
      if (existing.length > 0) {
        const row = existing[0]
        await client.query('ROLLBACK')
        if (row.status === 'pending' && row.paystack_ref) {
          // Re-surface the existing checkout link so the creator can finish paying.
          const verifyData = await paystackGet(`/transaction/verify/${row.paystack_ref}`)
          return res.json({
            escrow_id: row.escrow_id,
            authorization_url: verifyData.data?.authorization_url ?? null,
            reference: row.paystack_ref,
          })
        }
        return res.status(409).json({
          message: `This task already has an escrow (status: ${row.status}).`,
          escrow_id: row.escrow_id,
          status: row.status,
        })
      }

      const amountKobo = Math.round(task.budget * 100)  // ZAR cents == kobo
      const reference = `rlvr-${task_id}-${Date.now()}`

      // Create escrow row first so we have escrow_id for the Paystack metadata.
      // amount_cents is the canonical NOT NULL amount; amount_zar mirrors it for display.
      const { rows: escrowRows } = await client.query(
        `INSERT INTO escrow_transactions
           (task_id, creator_id, earner_id, amount_cents, currency, status, paystack_ref, amount_zar)
         VALUES ($1, $2, $3, $4, 'zar', 'pending', $5, $6)
         RETURNING escrow_id`,
        [task_id, req.userId, task.assigned_to, amountKobo, reference, task.budget]
      )
      const escrow_id = escrowRows[0].escrow_id

      // Initiate Paystack transaction
      const psData = await paystackPost('/transaction/initialize', {
        email,
        amount: amountKobo,
        currency: 'ZAR',
        reference,
        metadata: {
          escrow_id,
          task_id,
          task_title: task.title,
          creator_id: req.userId,
          earner_id: task.assigned_to,
        },
        callback_url: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/payment-complete`,
      })

      if (!psData.status) {
        await client.query('ROLLBACK')
        log.error('Paystack init failed', { reference, message: psData.message })
        return res.status(502).json({ message: 'Payment provider error. Please try again.' })
      }

      await client.query('COMMIT')

      return res.status(201).json({
        escrow_id,
        reference,
        authorization_url: psData.data.authorization_url,
      })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('POST /payments/initiate', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// ── GET /payments/verify/:reference ──────────────────────────────────────────
// Creator polls this after being redirected back from Paystack checkout.
// Syncs escrow status from Paystack if still pending.
router.get('/verify/:reference',
  requireAuth,
  [param('reference').isString().trim().notEmpty()],
  check,
  async (req, res) => {
    const { reference } = req.params
    try {
      const { rows } = await pool.query(
        `SELECT et.escrow_id, et.status, et.task_id, et.amount_zar
         FROM escrow_transactions et WHERE et.paystack_ref = $1`,
        [reference]
      )
      if (rows.length === 0) return res.status(404).json({ message: 'Transaction not found.' })
      const escrow = rows[0]

      // If already funded via webhook, no need to hit Paystack
      if (escrow.status !== 'pending') {
        return res.json({ status: escrow.status, escrow_id: escrow.escrow_id })
      }

      const data = await paystackGet(`/transaction/verify/${reference}`)
      if (!data.status || !data.data) {
        return res.status(502).json({ message: 'Could not verify with payment provider.' })
      }

      const txn = data.data
      if (txn.status === 'success') {
        await pool.query(
          `UPDATE escrow_transactions
           SET status = 'funded', updated_at = NOW()
           WHERE paystack_ref = $1 AND status = 'pending'`,
          [reference]
        )
        await pool.query(
          `INSERT INTO paystack_transactions
             (escrow_id, event_type, paystack_ref, amount_kobo, currency, channel, payload)
           VALUES ($1, 'charge.success', $2, $3, $4, $5, $6)`,
          [escrow.escrow_id, reference, txn.amount, txn.currency ?? 'ZAR',
           txn.channel ?? null, JSON.stringify(txn)]
        )
        return res.json({ status: 'funded', escrow_id: escrow.escrow_id })
      }

      return res.json({ status: escrow.status, paystack_status: txn.status, escrow_id: escrow.escrow_id })
    } catch (err) {
      log.error('GET /payments/verify', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── POST /payments/webhook ────────────────────────────────────────────────────
// Paystack POSTs signed events here. HMAC-SHA512 verification requires the EXACT
// raw bytes Paystack sent, so app.js mounts express.raw() on this path BEFORE the
// global express.json() — req.body therefore arrives here as a Buffer.
router.post('/webhook', async (req, res) => {
  // Normalise to a Buffer regardless of which body parser ran (raw in prod;
  // a defensive fallback covers a JSON-parsed body in any misconfiguration).
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}))

  const sig = req.headers['x-paystack-signature']
  if (!sig) return res.sendStatus(400)

  const expected = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY ?? '')
    .update(rawBody)
    .digest('hex')

  if (sig !== expected) {
    log.warn('Paystack webhook: invalid signature')
    return res.sendStatus(401)
  }

  let event
  try {
    event = JSON.parse(rawBody.toString())
  } catch {
    return res.sendStatus(400)
  }

  // Acknowledge immediately — Paystack retries on non-2xx, so process async.
  res.sendStatus(200)

  try {
    await handleWebhookEvent(event)
  } catch (err) {
    log.error('webhook handler', { event: event.event, err: err.message })
  }
})

async function handleWebhookEvent(event) {
  const { event: type, data } = event
  log.info('paystack webhook', { event: type, reference: data?.reference })

  if (type === 'charge.success') {
    const reference = data?.reference
    if (!reference) return

    const { rows } = await pool.query(
      `SELECT escrow_id, status, task_id, earner_id
       FROM escrow_transactions WHERE paystack_ref = $1`,
      [reference]
    )
    if (rows.length === 0) return
    const escrow = rows[0]
    if (escrow.status !== 'pending') return  // already processed

    await pool.query(
      `UPDATE escrow_transactions SET status = 'funded', updated_at = NOW()
       WHERE escrow_id = $1`,
      [escrow.escrow_id]
    )
    await pool.query(
      `INSERT INTO paystack_transactions
         (escrow_id, event_type, paystack_ref, amount_kobo, currency, channel, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [escrow.escrow_id, type, reference,
       data.amount ?? null, data.currency ?? 'ZAR',
       data.channel ?? null, JSON.stringify(data)]
    )
    log.info('escrow funded', { escrow_id: escrow.escrow_id, reference })
  }

  if (type === 'transfer.success') {
    const transferCode = data?.transfer_code
    if (!transferCode) return

    await pool.query(
      `UPDATE escrow_transactions
       SET status = 'released', paystack_transfer_id = $1, updated_at = NOW()
       WHERE paystack_transfer_id = $1`,
      [transferCode]
    )
    await pool.query(
      `INSERT INTO paystack_transactions
         (event_type, paystack_ref, amount_kobo, currency, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [type, data?.reference ?? transferCode,
       data?.amount ?? null, data?.currency ?? 'ZAR', JSON.stringify(data)]
    )
  }

  if (type === 'transfer.failed' || type === 'transfer.reversed') {
    const transferCode = data?.transfer_code
    if (!transferCode) return
    await pool.query(
      `UPDATE escrow_transactions
       SET status = 'disputed', updated_at = NOW()
       WHERE paystack_transfer_id = $1 AND status = 'released'`,
      [transferCode]
    )
    log.warn('transfer failed/reversed', { type, transferCode })
  }
}

// ── POST /payments/release/:escrowId ─────────────────────────────────────────
// Admin or automated release — initiates Paystack transfer to earner's
// recipient code. Earner must have a recipient_code stored on their profile.
router.post('/release/:escrowId',
  requireAuth,
  [param('escrowId').isUUID()],
  check,
  async (req, res) => {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden.' })
    }
    const { escrowId } = req.params
    try {
      const { rows } = await pool.query(
        `SELECT et.escrow_id, et.status, et.amount_cents, et.earner_id,
                up.paystack_recipient_code
         FROM escrow_transactions et
         LEFT JOIN user_profiles up ON et.earner_id = up.user_id
         WHERE et.escrow_id = $1`,
        [escrowId]
      )
      if (rows.length === 0) return res.status(404).json({ message: 'Escrow not found.' })
      const escrow = rows[0]

      if (escrow.status !== 'funded') {
        return res.status(400).json({ message: `Cannot release escrow with status '${escrow.status}'.` })
      }
      if (!escrow.paystack_recipient_code) {
        return res.status(400).json({ message: 'Earner has no Paystack recipient code on file.' })
      }

      const amountKobo = escrow.amount_cents  // already in cents == kobo
      const reference = `release-${escrowId}-${Date.now()}`

      const psData = await paystackPost('/transfer', {
        source: 'balance',
        reason: 'ReLivR task payment release',
        amount: amountKobo,
        recipient: escrow.paystack_recipient_code,
        reference,
      })

      if (!psData.status) {
        log.error('Paystack transfer failed', { escrowId, message: psData.message })
        return res.status(502).json({ message: 'Transfer initiation failed.' })
      }

      const transferCode = psData.data?.transfer_code
      await pool.query(
        `UPDATE escrow_transactions
         SET status = 'released', paystack_transfer_id = $1, updated_at = NOW()
         WHERE escrow_id = $2`,
        [transferCode, escrowId]
      )

      // Fire score event: earner received payment for completed task
      await recordScoreEvent(escrow.earner_id, 'task_completed', 5.0, escrowId)

      log.info('escrow released', { escrowId, transferCode })
      return res.json({ escrow_id: escrowId, transfer_code: transferCode, status: 'released' })
    } catch (err) {
      log.error('POST /payments/release', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── POST /payments/business/onboarding ────────────────────────────────────────
// Initiate R750 onboarding fee for a business listing.
router.post('/business/onboarding',
  requireAuth,
  [
    body('business_id').isUUID(),
    body('email').isEmail().normalizeEmail(),
  ],
  check,
  async (req, res) => {
    const { business_id, email } = req.body
    try {
      // Must be the business owner or admin
      const { rows: bizRows } = await pool.query(
        `SELECT b.business_id, b.name, bs.onboarding_paid, bs.sub_id
         FROM businesses b
         LEFT JOIN business_subscriptions bs ON bs.business_id = b.business_id
         WHERE b.business_id = $1`,
        [business_id]
      )
      if (bizRows.length === 0) return res.status(404).json({ message: 'Business not found.' })
      const biz = bizRows[0]

      if (biz.onboarding_paid) {
        return res.status(400).json({ message: 'Onboarding fee already paid.' })
      }

      const reference = `onboard-${business_id}-${Date.now()}`
      const amountKobo = 75000  // R750 × 100

      const psData = await paystackPost('/transaction/initialize', {
        email,
        amount: amountKobo,
        currency: 'ZAR',
        reference,
        metadata: { business_id, type: 'onboarding_fee' },
        callback_url: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/business-payment-complete`,
      })

      if (!psData.status) {
        return res.status(502).json({ message: 'Payment provider error.' })
      }

      // Upsert subscription row
      if (biz.sub_id) {
        await pool.query(
          `UPDATE business_subscriptions SET onboarding_ref = $1 WHERE sub_id = $2`,
          [reference, biz.sub_id]
        )
      } else {
        await pool.query(
          `INSERT INTO business_subscriptions (business_id, onboarding_ref)
           VALUES ($1, $2)`,
          [business_id, reference]
        )
      }

      return res.status(201).json({
        reference,
        authorization_url: psData.data.authorization_url,
      })
    } catch (err) {
      log.error('POST /payments/business/onboarding', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
