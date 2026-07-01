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
import { createNotification } from '../notify.js'
import { writeAudit } from '../audit.js'
import crypto from 'node:crypto'

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

// A "verified student" = a verified email whose domain is in the campus allowlist
// (student_domains). Gates claiming of student_only deals (A2).
async function isVerifiedStudent(userId) {
  const { rows } = await pool.query('SELECT email, is_email_verified FROM users WHERE user_id = $1', [userId])
  const u = rows[0]
  if (!u || !u.is_email_verified) return false
  const domain = (u.email || '').split('@')[1]?.toLowerCase()
  if (!domain) return false
  const d = await pool.query('SELECT 1 FROM student_domains WHERE domain = $1', [domain])
  return d.rows.length > 0
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

// F2: when a business posts a deal, alert everyone who follows that business
// (in-app + email per their preference). Best-effort; never blocks the create.
async function notifyDealFollowers(deal) {
  try {
    if (!deal || deal.status !== 'active') return
    const biz = await pool.query('SELECT name FROM businesses WHERE business_id = $1', [deal.business_id])
    const name = biz.rows[0]?.name || 'A business you follow'
    const fols = await pool.query("SELECT follower_id FROM follows WHERE target_type = 'business' AND target_id = $1", [deal.business_id])
    for (const f of fols.rows) {
      createNotification({
        userId: f.follower_id, type: 'deal.new',
        title: 'New deal from a business you follow',
        body: `${name} just posted "${deal.title}".`,
        referenceId: deal.deal_id,
      }).catch(() => {})
    }
  } catch (err) { log.error('notifyDealFollowers', { msg: err.message }) }
}

const PUBLIC_COLS = `d.deal_id, d.title, d.description, d.image_url, d.price_cents,
  d.original_price_cents, d.starts_at, d.expires_at, d.location_id, d.recurrence, d.student_only, d.created_at,
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
    body('studentOnly').optional().isBoolean(),
    body('recurrence').optional().isIn(['none', 'daily', 'weekly', 'monthly']),
    body('recurrenceUntil').optional({ nullable: true }).isISO8601(),
    body('expiresAt').isISO8601().bail().custom(futureDate),
  ],
  check,
  async (req, res) => {
    try {
      const biz = await ownedBusiness(req.userId)
      if (!biz) return res.status(403).json({ message: 'No business is linked to your account.' })
      const df = await pool.query('SELECT disabled_features FROM businesses WHERE business_id = $1', [biz.business_id])
      if ((df.rows[0]?.disabled_features || []).includes('deals')) return res.status(403).json({ message: 'Deals are turned off for your business.' })
      const imageUrl = cleanImageUrl(req.body.imageUrl)
      const b = req.body
      const recurrence = b.recurrence || 'none'
      // Capture the first window's length so every recurring cycle matches it.
      const activeWindowS = recurrence !== 'none'
        ? Math.max(60, Math.round((new Date(b.expiresAt).getTime() - Date.now()) / 1000))
        : null
      const { rows } = await pool.query(
        `INSERT INTO campus_deals
           (business_id, business_owner_id, location_id, title, description, image_url,
            price_cents, original_price_cents, status, expires_at,
            recurrence, recurrence_until, active_window_s, student_only)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [biz.business_id, req.userId, b.locationId || null, b.title, b.description || null,
         imageUrl, b.priceCents ?? null, b.originalPriceCents ?? null, b.status || 'active', b.expiresAt,
         recurrence, b.recurrenceUntil || null, activeWindowS, b.studentOnly === true])
      notifyDealFollowers(rows[0])   // F2 — fire-and-forget fan-out to followers
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
    body('studentOnly').optional().isBoolean(),
    body('recurrence').optional().isIn(['none', 'daily', 'weekly', 'monthly']),
    body('recurrenceUntil').optional({ nullable: true }).isISO8601(),
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
      if (req.body.studentOnly !== undefined)        { sets.push(`student_only = $${i++}`);         vals.push(req.body.studentOnly === true) }
      if (req.body.expiresAt !== undefined)          { sets.push(`expires_at = $${i++}`);           vals.push(req.body.expiresAt) }
      if (req.body.imageUrl !== undefined)           { sets.push(`image_url = $${i++}`);            vals.push(cleanImageUrl(req.body.imageUrl)) }
      if (req.body.recurrence !== undefined)         { sets.push(`recurrence = $${i++}`);           vals.push(req.body.recurrence) }
      if (req.body.recurrenceUntil !== undefined)    { sets.push(`recurrence_until = $${i++}`);     vals.push(req.body.recurrenceUntil || null) }
      // Keep the recurring window in sync with the edited expiry (null for 'none').
      if (req.body.expiresAt !== undefined && req.body.recurrence !== undefined) {
        const aws = req.body.recurrence !== 'none'
          ? Math.max(60, Math.round((new Date(req.body.expiresAt).getTime() - Date.now()) / 1000))
          : null
        sets.push(`active_window_s = $${i++}`); vals.push(aws)
      }
      if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update.' })
      sets.push('updated_at = NOW()'); vals.push(req.params.id)
      const { rows } = await pool.query(
        `UPDATE campus_deals SET ${sets.join(', ')} WHERE deal_id = $${i} RETURNING *`, vals)
      if (req.userRole === 'admin') {
        await writeAudit({ actorId: req.userId, actorRole: req.userRole, action: 'admin.deal.update',
          entityType: 'deal', entityId: req.params.id, after: { status: rows[0]?.status }, reqId: req.id })
      }
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
    if (req.userRole === 'admin') {
      await writeAudit({ actorId: req.userId, actorRole: req.userRole, action: 'admin.deal.delete',
        entityType: 'deal', entityId: req.params.id, reqId: req.id })
    }
    return res.status(200).json({ message: 'Deal deleted.' })
  } catch (err) {
    log.error('DELETE /deals/:id', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── CUSTOMER: redeem (claim) an active deal — records a transaction ──
// POST /deals/:id/redeem
router.post('/:id/redeem', requireAuth, [ param('id').isUUID() ], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT deal_id, business_id, business_owner_id, price_cents, status, expires_at
         FROM campus_deals WHERE deal_id = $1`, [req.params.id])
    const deal = rows[0]
    // Same active guard as the public read — can't claim an expired/inactive deal.
    if (!deal || deal.status !== 'active' || new Date(deal.expires_at).getTime() <= Date.now()) {
      return res.status(404).json({ message: 'This deal is no longer available.' })
    }
    if (deal.business_owner_id === req.userId) {
      return res.status(400).json({ message: "You can't redeem your own deal." })
    }
    let redemption
    try {
      const ins = await pool.query(
        `INSERT INTO deal_redemptions (deal_id, business_id, customer_id, amount_cents)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [deal.deal_id, deal.business_id, req.userId, deal.price_cents ?? null])
      redemption = ins.rows[0]
    } catch (err) {
      // The per-day unique index rejects a repeat claim on the same calendar day.
      if (/uq_redemption_per_day|duplicate key|unique/i.test(err.message)) {
        return res.status(409).json({ message: 'You already claimed this deal today.' })
      }
      throw err
    }
    createNotification({
      userId: deal.business_owner_id, type: 'deal.redeemed',
      title: 'A customer claimed your deal', body: 'Someone just redeemed one of your Campus Deals.',
      referenceId: deal.deal_id,
    }).catch(() => {})
    return res.status(201).json({ redemption })
  } catch (err) {
    log.error('POST /deals/:id/redeem', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── CUSTOMER: claim a deal → a one-time QR token the business later redeems (A2) ──
// POST /deals/:id/claim   (student_only deals require a verified student)
router.post('/:id/claim', requireAuth, [ param('id').isUUID() ], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT deal_id, business_owner_id, student_only, status, expires_at FROM campus_deals WHERE deal_id = $1`, [req.params.id])
    const deal = rows[0]
    if (!deal || deal.status !== 'active' || new Date(deal.expires_at).getTime() <= Date.now()) {
      return res.status(404).json({ message: 'This deal is no longer available.' })
    }
    if (deal.business_owner_id === req.userId) return res.status(400).json({ message: "You can't claim your own deal." })
    if (deal.student_only && !(await isVerifiedStudent(req.userId))) {
      return res.status(403).json({ message: 'This deal is for verified students — verify your student email to claim it.' })
    }
    // Re-claiming returns the existing live token (idempotent QR), never a duplicate.
    const existing = await pool.query(
      `SELECT * FROM deal_claims WHERE deal_id = $1 AND user_id = $2 AND status = 'claimed'`, [deal.deal_id, req.userId])
    if (existing.rows.length) return res.status(200).json({ claim: existing.rows[0] })
    const token = crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()
    const ins = await pool.query(
      `INSERT INTO deal_claims (deal_id, user_id, token) VALUES ($1,$2,$3) RETURNING *`, [deal.deal_id, req.userId, token])
    return res.status(201).json({ claim: ins.rows[0] })
  } catch (err) {
    log.error('POST /deals/:id/claim', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── OWNER: redeem a student's claim token (the business "scans" the QR) (A2) ──
// POST /deals/redeem-token   { token }  — records a normal deal_redemption.
router.post('/redeem-token', requireAuth, [ body('token').trim().isLength({ min: 4, max: 24 }) ], check, async (req, res) => {
  try {
    const biz = await ownedBusiness(req.userId)
    if (!biz) return res.status(403).json({ message: 'No business is linked to your account.' })
    const token = req.body.token.trim().toUpperCase()
    const { rows } = await pool.query(
      `SELECT c.claim_id, c.status, c.user_id, d.deal_id, d.business_id, d.title, d.price_cents,
              d.status AS deal_status, d.expires_at
         FROM deal_claims c JOIN campus_deals d ON d.deal_id = c.deal_id
        WHERE c.token = $1`, [token])
    const row = rows[0]
    if (!row) return res.status(404).json({ message: 'Code not found.' })
    if (row.business_id !== biz.business_id) return res.status(403).json({ message: 'This code is for another business.' })
    if (row.status === 'redeemed') return res.status(409).json({ message: 'This code has already been redeemed.' })
    if (row.deal_status !== 'active' || new Date(row.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ message: 'This deal has expired.' })
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const upd = await client.query(
        `UPDATE deal_claims SET status = 'redeemed', redeemed_at = NOW() WHERE claim_id = $1 AND status = 'claimed' RETURNING claim_id`, [row.claim_id])
      if (upd.rows.length === 0) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'This code has already been redeemed.' }) }
      await client.query(
        `INSERT INTO deal_redemptions (deal_id, business_id, customer_id, amount_cents)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [row.deal_id, row.business_id, row.user_id, row.price_cents ?? null])
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
    const cust = await pool.query('SELECT display_name FROM user_profiles WHERE user_id = $1', [row.user_id])
    return res.status(200).json({ ok: true, dealTitle: row.title, customer: cust.rows[0]?.display_name || 'Student' })
  } catch (err) {
    log.error('POST /deals/redeem-token', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── OWNER: Client History — aggregate of everyone who redeemed my deals ──
// GET /deals/mine/clients   (the business "Client History" dashboard data)
router.get('/mine/clients', requireAuth, async (req, res) => {
  try {
    const biz = await ownedBusiness(req.userId)
    if (!biz) return res.status(403).json({ message: 'No business is linked to your account.' })
    const id = biz.business_id

    const summary = await pool.query(
      `SELECT COUNT(*)::int AS total_redemptions,
              COUNT(DISTINCT customer_id)::int AS unique_customers,
              COALESCE(SUM(amount_cents),0)::int AS total_value_cents,
              COUNT(*) FILTER (WHERE redeemed_at > NOW() - INTERVAL '30 days')::int AS last_30d
         FROM deal_redemptions WHERE business_id = $1`, [id])

    const repeat = await pool.query(
      `SELECT COUNT(*)::int AS repeat_customers FROM (
          SELECT customer_id FROM deal_redemptions
           WHERE business_id = $1 AND customer_id IS NOT NULL
           GROUP BY customer_id HAVING COUNT(*) > 1
       ) r`, [id])

    const series = await pool.query(
      `SELECT to_char(d.day,'YYYY-MM-DD') AS day, COALESCE(c.cnt,0)::int AS count
         FROM generate_series(CURRENT_DATE - 29 * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') AS d(day)
         LEFT JOIN (
            SELECT date_trunc('day', redeemed_at)::date AS day, COUNT(*) AS cnt
              FROM deal_redemptions
             WHERE business_id = $1 AND redeemed_at >= CURRENT_DATE - 29 * INTERVAL '1 day'
             GROUP BY 1
         ) c ON c.day = d.day::date
        ORDER BY d.day`, [id])

    const recent = await pool.query(
      `SELECT r.redemption_id, r.redeemed_at, r.amount_cents,
              d.title AS deal_title, up.display_name AS customer_name
         FROM deal_redemptions r
         LEFT JOIN campus_deals d ON d.deal_id = r.deal_id
         LEFT JOIN user_profiles up ON up.user_id = r.customer_id
        WHERE r.business_id = $1
        ORDER BY r.redeemed_at DESC LIMIT 50`, [id])

    const s = summary.rows[0]
    return res.status(200).json({
      business_id: id,
      total_redemptions: s.total_redemptions,
      unique_customers: s.unique_customers,
      repeat_customers: repeat.rows[0].repeat_customers,
      total_value_cents: s.total_value_cents,
      last_30d: s.last_30d,
      redemptions_series: series.rows,
      recent: recent.rows,
    })
  } catch (err) {
    log.error('GET /deals/mine/clients', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
