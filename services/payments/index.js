// services/payments/index.js
import 'dotenv/config'
import express from 'express'
import Stripe from 'stripe'
import pg from 'pg'
import { param, validationResult } from 'express-validator'

const { Pool } = pg
const app = express()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0.10')

app.use('/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /payments/connect/onboard
app.post('/payments/connect/onboard', async (req, res) => {
  const userId = req.headers['x-user-id']
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'
  try {
    const existing = await pool.query('SELECT stripe_account_id, onboarding_complete FROM stripe_accounts WHERE user_id=$1', [userId])
    let stripeAccountId
    if (existing.rows.length > 0) {
      if (existing.rows[0].onboarding_complete) return res.status(409).json({ message: 'Stripe account already connected.' })
      stripeAccountId = existing.rows[0].stripe_account_id
    } else {
      const account = await stripe.accounts.create({ type: 'express', metadata: { taskfinder_user_id: userId } })
      stripeAccountId = account.id
      await pool.query('INSERT INTO stripe_accounts (user_id, stripe_account_id) VALUES ($1,$2)', [userId, stripeAccountId])
    }
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${CLIENT_URL}/onboarding/refresh`,
      return_url: `${CLIENT_URL}/onboarding/complete`,
      type: 'account_onboarding',
    })
    return res.status(200).json({ onboardingUrl: accountLink.url })
  } catch (err) {
    console.error('[onboard]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// POST /payments/tasks/:taskId/fund
app.post('/payments/tasks/:taskId/fund', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  const creatorId = req.headers['x-user-id']
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const taskResult = await client.query(
      "SELECT t.*, b.bidder_id AS earner_id, b.amount AS bid_amount FROM tasks t JOIN bids b ON b.task_id=t.task_id AND b.status='accepted' WHERE t.task_id=$1 AND t.creator_id=$2 AND t.status='in_progress' FOR UPDATE",
      [taskId, creatorId]
    )
    if (taskResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Task not ready for payment.' }) }
    const task = taskResult.rows[0]
    const earnerAccount = await client.query('SELECT stripe_account_id FROM stripe_accounts WHERE user_id=$1 AND onboarding_complete=TRUE', [task.earner_id])
    if (earnerAccount.rows.length === 0) { await client.query('ROLLBACK'); return res.status(402).json({ message: 'Earner has not completed payment onboarding.' }) }
    const amountCents = Math.round(parseFloat(task.bid_amount) * 100)
    const feeCents = Math.round(amountCents * PLATFORM_FEE_PERCENT)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents, currency: 'usd', capture_method: 'manual',
      application_fee_amount: feeCents,
      transfer_data: { destination: earnerAccount.rows[0].stripe_account_id },
      metadata: { task_id: taskId, creator_id: creatorId, earner_id: task.earner_id },
    })
    await client.query(
      'INSERT INTO escrow_transactions (task_id,creator_id,earner_id,amount_cents,platform_fee_cents,stripe_payment_intent_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [taskId, creatorId, task.earner_id, amountCents, feeCents, paymentIntent.id, 'pending']
    )
    await client.query('COMMIT')
    return res.status(200).json({ clientSecret: paymentIntent.client_secret, amountCents, feeCents })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[fund]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  } finally {
    client.release()
  }
})

// POST /payments/tasks/:taskId/release
app.post('/payments/tasks/:taskId/release', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const escrow = await client.query("SELECT * FROM escrow_transactions WHERE task_id=$1 AND status='funded' FOR UPDATE", [taskId])
    if (escrow.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'No funded escrow found.' }) }
    const captured = await stripe.paymentIntents.capture(escrow.rows[0].stripe_payment_intent_id)
    await client.query("UPDATE escrow_transactions SET status='released', released_at=NOW(), stripe_transfer_id=$1 WHERE escrow_id=$2", [captured.transfer, escrow.rows[0].escrow_id])
    await client.query("UPDATE tasks SET status='completed' WHERE task_id=$1", [taskId])
    await client.query('COMMIT')
    return res.status(200).json({ message: 'Funds released.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[release]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  } finally {
    client.release()
  }
})

// POST /payments/tasks/:taskId/refund  (admin only)
app.post('/payments/tasks/:taskId/refund', [param('taskId').isUUID()], handleValidation, async (req, res) => {
  const { taskId } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const escrow = await client.query("SELECT * FROM escrow_transactions WHERE task_id=$1 AND status IN ('funded','disputed') FOR UPDATE", [taskId])
    if (escrow.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'No refundable escrow found.' }) }
    await stripe.paymentIntents.cancel(escrow.rows[0].stripe_payment_intent_id)
    await client.query("UPDATE escrow_transactions SET status='refunded', refunded_at=NOW() WHERE escrow_id=$1", [escrow.rows[0].escrow_id])
    await client.query("UPDATE tasks SET status='completed' WHERE task_id=$1", [taskId])
    await client.query('COMMIT')
    return res.status(200).json({ message: 'Refund processed.' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[refund]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  } finally {
    client.release()
  }
})

// POST /payments/webhook
app.post('/payments/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).json({ message: `Webhook error: ${err.message}` })
  }
  if (event.type === 'payment_intent.amount_capturable_updated') {
    const intent = event.data.object
    await pool.query("UPDATE escrow_transactions SET status='funded', funded_at=NOW() WHERE stripe_payment_intent_id=$1 AND status='pending'", [intent.id])
  }
  return res.status(200).json({ received: true })
})

const PORT = process.env.PORT || 3003
app.listen(PORT, () => console.log(`Payments service running on port ${PORT}`))