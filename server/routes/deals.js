// server/routes/deals.js — Campus Deals: time-limited "Limited Time Specials".
//
// RBAC (reuses the businesses.js model — authorise by OWNERSHIP, not role alone):
//   • PUBLIC  — read ACTIVE deals only (the campus-wide Deals page).
//   • BUSINESS— create/read/update/delete their OWN deals (business_owner_id == caller).
//   • ADMIN   — moderate/remove ANY deal.
//
// EXPIRY SAFETY: "active" is enforced at QUERY time with
//     WHERE status = 'active' AND expires_at > NOW()
// using the DB server clock — atomic, on every read, impossible to bypass from
// the client. The jobs.expireDeals() sweep that flips status->'expired' is
// housekeeping only; the filter above hides lapsed deals even if it never runs.
import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth, requireAdmin } from '../middleware.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// The caller's business (ownership root). One business per owner (LIMIT 1).
async function ownedBusiness(userId) {
  const { rows } = await pool.query(
    'SELECT business_id FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [userId])
  return rows[0] || null
}

// Allow empty/null; reject dangerous schemes; require an http(s) host. Mirrors
// the intent of businesses.cleanUrl so a deal image can only be a real URL.
function cleanImageUrl(value) {
  if (value === '' || value === null || value === undefined) return null
  const v = String(value).trim()
  if (v === '') return null
  if (/^\s*(javascript|data|vbscript|file):/i.test(v)) throw new Error('Disallowed image URL.')
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`
  let u; try { u = new URL(candidate) } catch { throw new Error('Invalid image URL.') }
  if (!u.hostname || !u.hostname.includes('.')) throw new Error('Invalid image URL.')
  return candidate
}

// express-validator helper: a valid ISO date strictly in the future.
const futureDate = v => { if (new Date(v).getTime() <= Date.now()) throw new Error('expiresAt must be in the future.'); return true }

const PUBLIC_COLS = `d.deal_id, d.title, d.description, d.image_url, d.price_cents,
  d.original_price_cents, d.starts_at, d.expires_at, d.location_id, d.created_at,
  b.business_id, b.name AS business_name, b.logo_url, b.category`

// ── PUBLIC: active, campus-wide deals ──
// GET /deals?campus=<location_id>
router.get('/',
  [ query('campus').optional().isUUID() ],
  check,
  async (req, res) => {
    try {
      const campus = req.query.campus || null
      const { rows } = await pool.query(
        `SELECT ${PUBLIC_COLS}
           FROM campus_deals d
           JOIN businesses b ON b.business_id = d.business_id
          WHERE d.status = 'active'
            AND d.expires_at > NOW()
            AND b.status = 'active'
            AND ($1::uuid IS NULL OR d.location_id = $1 OR d.location_id IS NULL)
          ORDER BY d.expires_at ASC
          LIMIT 100`,
        [campus])
      return res.status(200).json({ deals: rows })
    } catch (err) {
      log.error('GET /deals', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER: my deals (all statuses, incl. draft/expired) ──
// GET /deals/mine   (declared before /:id so it isn't captured as a UUID param)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const biz = await ownedBusiness(req.userId)
    if (!biz) return res.status(403).json({ message: 'No business is linked to your account.' })
    const { rows } = await pool.query(
      `SELECT * FROM campus_deals WHERE business_id = $1 ORDER BY created_at DESC`, [biz.business_id])
    return res.status(200).json({ deals: rows })
  } catch (err) {
    log.error('GET /deals/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── ADMIN: every deal (any status) for the moderation queue ──
// GET /deals/admin/all
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, b.name AS business_name
         FROM campus_deals d JOIN businesses b ON b.business_id = d.business_id
        ORDER BY d.created_at DESC LIMIT 500`)
    return res.status(200).json({ deals: rows })
  } catch (err) {
    log.error('GET /deals/admin/all', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── PUBLIC: a single ACTIVE deal ──
// GET /deals/:id   (expired/inactive → 404, same opacity as /businesses/:id)
router.get('/:id', [ param('id').isUUID() ], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_COLS}
         FROM campus_deals d JOIN businesses b ON b.business_id = d.business_id
        WHERE d.deal_id = $1 AND d.status = 'active' AND d.expires_at > NOW() AND b.status = 'active'`,
      [req.params.id])
    if (rows.length === 0) return res.status(404).json({ message: 'Deal not found.' })
    return res.status(200).json({ deal: rows[0] })
  } catch (err) {
    log.error('GET /deals/:id', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── OWNER: create a deal ──
// POST /deals
router.post('/',
  requireAuth,
  [
    body('title').trim().isLength({ min: 1, max: 120 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('priceCents').optional({ nullable: true }).isInt({ min: 0 }),
    body('originalPriceCents').optional({ nullable: true }).isInt({ min: 0 }),
    body('locationId').optional({ nullable: true }).isUUID(),
    body('status').optional().isIn(['draft', 'active']),
    body('expiresAt').isISO8601().bail().custom(futureDate),
  ],
  check,
  async (req, res) => {
    try {
      const biz = await ownedBusiness(req.userId)
      if (!biz) return res.status(403).json({ message: 'No business is linked to your account.' })
      const imageUrl = cleanImageUrl(req.body.imageUrl)
      const b = req.body
      const { rows } = await pool.query(
        `INSERT INTO campus_deals
           (business_id, business_owner_id, location_id, title, description, image_url,
            price_cents, original_price_cents, status, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [biz.business_id, req.userId, b.locationId || null, b.title, b.description || null,
         imageUrl, b.priceCents ?? null, b.originalPriceCents ?? null, b.status || 'active', b.expiresAt])
      return res.status(201).json({ deal: rows[0] })
    } catch (err) {
      if (/image URL|future/i.test(err.message)) return res.status(422).json({ message: err.message })
      log.error('POST /deals', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER (own) / ADMIN (any): update a deal ──
// PATCH /deals/:id
router.patch('/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('title').optional().trim().isLength({ min: 1, max: 120 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('priceCents').optional({ nullable: true }).isInt({ min: 0 }),
    body('originalPriceCents').optional({ nullable: true }).isInt({ min: 0 }),
    body('locationId').optional({ nullable: true }).isUUID(),
    body('status').optional().isIn(['draft', 'active', 'archived']),
    body('expiresAt').optional().isISO8601().bail().custom(futureDate),
  ],
  check,
  async (req, res) => {
    try {
      const found = await pool.query(
        'SELECT business_owner_id FROM campus_deals WHERE deal_id = $1', [req.params.id])
      if (found.rows.length === 0) return res.status(404).json({ message: 'Deal not found.' })
      if (req.userRole !== 'admin' && found.rows[0].business_owner_id !== req.userId) {
        return res.status(403).json({ message: 'You can only edit your own deals.' })
      }
      const sets = [], vals = []; let i = 1
      const map = { title: 'title', description: 'description', status: 'status' }
      for (const [k, col] of Object.entries(map)) {
        if (req.body[k] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(req.body[k] === '' ? null : req.body[k]) }
      }
      if (req.body.priceCents !== undefined)         { sets.push(`price_cents = $${i++}`);          vals.push(req.body.priceCents) }
      if (req.body.originalPriceCents !== undefined) { sets.push(`original_price_cents = $${i++}`); vals.push(req.body.originalPriceCents) }
      if (req.body.locationId !== undefined)         { sets.push(`location_id = $${i++}`);          vals.push(req.body.locationId || null) }
      if (req.body.expiresAt !== undefined)          { sets.push(`expires_at = $${i++}`);           vals.push(req.body.expiresAt) }
      if (req.body.imageUrl !== undefined)           { sets.push(`image_url = $${i++}`);            vals.push(cleanImageUrl(req.body.imageUrl)) }
      if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update.' })
      sets.push('updated_at = NOW()'); vals.push(req.params.id)
      const { rows } = await pool.query(
        `UPDATE campus_deals SET ${sets.join(', ')} WHERE deal_id = $${i} RETURNING *`, vals)
      return res.status(200).json({ deal: rows[0] })
    } catch (err) {
      if (/image URL|future/i.test(err.message)) return res.status(422).json({ message: err.message })
      log.error('PATCH /deals/:id', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER (own) / ADMIN (any): delete a deal ──
// DELETE /deals/:id
router.delete('/:id', requireAuth, [ param('id').isUUID() ], check, async (req, res) => {
  try {
    const found = await pool.query(
      'SELECT business_owner_id FROM campus_deals WHERE deal_id = $1', [req.params.id])
    if (found.rows.length === 0) return res.status(404).json({ message: 'Deal not found.' })
    if (req.userRole !== 'admin' && found.rows[0].business_owner_id !== req.userId) {
      return res.status(403).json({ message: 'You can only delete your own deals.' })
    }
    await pool.query('DELETE FROM campus_deals WHERE deal_id = $1', [req.params.id])
    return res.status(200).json({ message: 'Deal deleted.' })
  } catch (err) {
    log.error('DELETE /deals/:id', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
