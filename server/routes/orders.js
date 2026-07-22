// server/routes/orders.js — catalogue orders (pay-on-collection).
//
// A viewer places an ORDER against a business's public catalogue item
// (business_products). This is a reservation, NOT a card charge: payment is
// arranged directly with the business on collection (cash/EFT). See
// db/init/60_product_orders.sql for the schema and lifecycle.
//
// Routes (mounted at /orders):
//   POST   /orders                 — buyer places an order
//   GET    /orders/mine            — buyer: orders I placed
//   GET    /orders/received        — owner: orders for my business
//   PATCH  /orders/:id/status      — owner: accept → ready → completed / cancel
//   PATCH  /orders/:id/cancel      — buyer: cancel my own (pending) order
import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { createNotification } from '../notify.js'
import { requireAuth } from '../middleware.js'
import { rejectIfProfane } from '../profanity.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// Owner-side status transitions the business may drive. 'cancelled' is reachable
// from any non-terminal state; the forward path is pending→accepted→ready→completed.
const OWNER_STATUSES = ['accepted', 'ready', 'completed', 'cancelled']
const TERMINAL = ['completed', 'cancelled']

function serializeOrder(r) {
  return {
    order_id: r.order_id, product_id: r.product_id, business_id: r.business_id,
    buyer_id: r.buyer_id, quantity: r.quantity,
    unit_price_cents: r.unit_price_cents, total_cents: r.total_cents,
    note: r.note, contact_phone: r.contact_phone, fulfilment: r.fulfilment,
    status: r.status, created_at: r.created_at, updated_at: r.updated_at,
    // joined display fields (present on list queries)
    product_name: r.product_name ?? undefined,
    business_name: r.business_name ?? undefined,
    buyer_name: r.buyer_name ?? undefined,
  }
}

// ── BUYER: place an order ─────────────────────────────────────────────────────
// POST /orders  { product_id, quantity?, note?, contact_phone? }
router.post('/',
  requireAuth,
  [
    body('product_id').isUUID(),
    body('quantity').optional().isInt({ min: 1, max: 999 }),
    body('note').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('contact_phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
  ],
  check,
  async (req, res) => {
    const quantity = req.body.quantity ?? 1
    const note = (req.body.note || '').trim() || null
    const contactPhone = (req.body.contact_phone || '').trim() || null
    if (rejectIfProfane(res, note || '')) return
    try {
      // The item must exist, be available, and its business active. Join through
      // so we snapshot price and know who to notify — all in one read.
      const { rows: prod } = await pool.query(
        `SELECT p.product_id, p.name, p.price_cents, p.is_available,
                b.business_id, b.owner_id, b.name AS business_name, b.status AS business_status
           FROM business_products p
           JOIN businesses b ON b.business_id = p.business_id
          WHERE p.product_id = $1`,
        [req.body.product_id])
      if (prod.length === 0) return res.status(404).json({ message: 'Item not found.' })
      const p = prod[0]
      if (!p.is_available || p.business_status !== 'active') {
        return res.status(409).json({ message: 'This item is not available to order right now.' })
      }
      if (p.owner_id === req.userId) {
        return res.status(403).json({ message: "You can't order your own catalogue item." })
      }

      const unitPrice = p.price_cents            // NULL = POA (price on collection)
      const total = unitPrice == null ? null : unitPrice * quantity

      const { rows } = await pool.query(
        `INSERT INTO product_orders
           (product_id, business_id, buyer_id, quantity, unit_price_cents, total_cents, note, contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [p.product_id, p.business_id, req.userId, quantity, unitPrice, total, note, contactPhone])

      createNotification({
        userId: p.owner_id,
        type: 'order.placed',
        title: 'New catalogue order',
        body: `Someone ordered ${quantity}× "${p.name}"${total != null ? ` (R${(total / 100).toFixed(2)})` : ''}.`,
        referenceId: rows[0].order_id,
      })

      return res.status(201).json({ order: serializeOrder(rows[0]) })
    } catch (err) {
      log.error('POST /orders', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── BUYER: orders I placed ────────────────────────────────────────────────────
// GET /orders/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, p.name AS product_name, b.name AS business_name
         FROM product_orders o
         JOIN business_products p ON p.product_id = o.product_id
         JOIN businesses b ON b.business_id = o.business_id
        WHERE o.buyer_id = $1
        ORDER BY o.created_at DESC`,
      [req.userId])
    return res.status(200).json({ orders: rows.map(serializeOrder) })
  } catch (err) {
    log.error('GET /orders/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── OWNER: orders for my business ─────────────────────────────────────────────
// GET /orders/received?status=pending
router.get('/received',
  requireAuth,
  [query('status').optional().isIn(['pending', 'accepted', 'ready', 'completed', 'cancelled'])],
  check,
  async (req, res) => {
    try {
      const { rows: biz } = await pool.query(
        'SELECT business_id FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [req.userId])
      const businessId = biz[0]?.business_id
      if (!businessId) return res.status(404).json({ message: 'No business is linked to your account yet.' })

      const params = [businessId]
      let where = 'o.business_id = $1'
      if (req.query.status) { params.push(req.query.status); where += ` AND o.status = $${params.length}` }

      const { rows } = await pool.query(
        `SELECT o.*, p.name AS product_name, bp.display_name AS buyer_name
           FROM product_orders o
           JOIN business_products p ON p.product_id = o.product_id
           LEFT JOIN user_profiles bp ON bp.user_id = o.buyer_id
          WHERE ${where}
          ORDER BY o.created_at DESC`,
        params)
      return res.status(200).json({ orders: rows.map(serializeOrder) })
    } catch (err) {
      log.error('GET /orders/received', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER: advance / cancel an order ──────────────────────────────────────────
// PATCH /orders/:id/status  { status }
router.patch('/:id/status',
  requireAuth,
  [param('id').isUUID(), body('status').isIn(OWNER_STATUSES)],
  check,
  async (req, res) => {
    const { id } = req.params
    const next = req.body.status
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // The order must belong to a business this caller owns.
      const { rows } = await client.query(
        `SELECT o.*, p.name AS product_name
           FROM product_orders o
           JOIN businesses b ON b.business_id = o.business_id
           JOIN business_products p ON p.product_id = o.product_id
          WHERE o.order_id = $1 AND b.owner_id = $2
          FOR UPDATE OF o`,
        [id, req.userId])
      if (rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Order not found.' })
      }
      const order = rows[0]
      if (TERMINAL.includes(order.status)) {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: `Order is already ${order.status}.` })
      }

      const { rows: upd } = await client.query(
        `UPDATE product_orders
            SET status = $1, cancelled_by = $2
          WHERE order_id = $3 RETURNING *`,
        [next, next === 'cancelled' ? req.userId : null, id])
      await client.query('COMMIT')

      const label = { accepted: 'accepted', ready: 'ready for collection', completed: 'completed', cancelled: 'cancelled' }[next]
      createNotification({
        userId: order.buyer_id,
        type: `order.${next}`,
        title: `Order ${label}`,
        body: `Your order for "${order.product_name}" was ${label}.`,
        referenceId: id,
      })

      return res.status(200).json({ order: serializeOrder(upd[0]) })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('PATCH /orders/:id/status', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// ── BUYER: cancel my own order (only while still pending) ──────────────────────
// PATCH /orders/:id/cancel
router.patch('/:id/cancel',
  requireAuth,
  [param('id').isUUID()],
  check,
  async (req, res) => {
    const { id } = req.params
    try {
      // Guarded update: only the buyer's own still-pending order flips to cancelled.
      const { rows } = await pool.query(
        `UPDATE product_orders
            SET status = 'cancelled', cancelled_by = $1
          WHERE order_id = $2 AND buyer_id = $1 AND status = 'pending'
          RETURNING order_id, business_id, product_id`,
        [req.userId, id])
      if (rows.length === 0) {
        return res.status(409).json({ message: 'Order not found, not yours, or no longer cancellable.' })
      }
      // Let the business know a pending order was withdrawn.
      const { rows: biz } = await pool.query(
        'SELECT owner_id FROM businesses WHERE business_id = $1', [rows[0].business_id])
      if (biz[0]) {
        createNotification({
          userId: biz[0].owner_id,
          type: 'order.cancelled',
          title: 'Order cancelled',
          body: 'A customer cancelled a pending catalogue order.',
          referenceId: id,
        })
      }
      return res.status(200).json({ message: 'Order cancelled.' })
    } catch (err) {
      log.error('PATCH /orders/:id/cancel', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
