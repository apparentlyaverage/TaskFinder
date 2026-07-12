// server/routes/businesses.js — local business listings (founding-partner track)
//   • Businesses are LISTED-ONLY: the team/reps create & manage them; they do not log in.
//   • Public GET endpoints power the student-facing "Local" browse section.
//   • Write endpoints (create/update/delete) require an authenticated ADMIN.
//   • Images: we store an array of URLs (image_urls). Today those can be any valid
//     https image URL (e.g. pasted, or from Cloudinary's unsigned upload widget).
//     When a Cloudinary account is added, the same field holds the returned URLs —
//     no schema change needed.
import { Router } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'
import { createNotification } from '../notify.js'
import { rejectIfProfane } from '../profanity.js'
import { validateLocationName, resolveLocationId } from '../locationValidate.js'

const router = Router()

// Public page-event tracking is unauthenticated and writes a row per call, so it
// gets its own limiter on top of the global ceiling — generous enough for real
// browsing, tight enough to stop a single IP inflating a business's analytics.
const eventsLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { message: 'Too many events from this client.' },
})

// Fields a business OWNER may edit on their own page. Deliberately excludes
// status, fee_paid, paid_at, expires_at, signed_by_rep, notes, owner_id — those
// are admin-only (an owner must never flip themselves to 'active' for free).
// Plain text fields mapped body-key → column. themeColor / socials / URL / image
// fields are handled explicitly below because they need validation/normalisation.
const OWNER_EDITABLE = {
  name: 'name', category: 'category', description: 'description', address: 'address',
  mapHint: 'map_hint', phone: 'phone', whatsapp: 'whatsapp', email: 'email',
  hours: 'hours', tagline: 'tagline',
}

const SOCIAL_KEYS = ['website', 'instagram', 'facebook', 'tiktok', 'twitter', 'linkedin']

// Validate/normalise the socials object: known keys only, each a short string.
function cleanSocials(value) {
  if (value === undefined) return undefined
  if (value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('socials must be an object.')
  const out = {}
  for (const k of SOCIAL_KEYS) {
    if (value[k] === undefined || value[k] === null || value[k] === '') continue
    const v = String(value[k]).trim()
    if (v.length > 200) throw new Error('Social link too long.')
    // website is a full URL; the rest may be a handle or URL — store as given (trimmed).
    out[k] = k === 'website' ? cleanUrl(v) : v
  }
  return out
}

// #RGB or #RRGGBB (with optional alpha) — reject anything else.
function cleanHexColor(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const v = String(value).trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) throw new Error('Invalid theme colour.')
  return v
}

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// Admin gate — runs after requireAuth (which sets req.userRole from the JWT)
function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' })
  }
  next()
}

// Reject dangerous/invalid URLs; allow empty. Normalises scheme-less to https://.
function cleanUrl(value) {
  if (value === '' || value === null || value === undefined) return null
  const v = String(value).trim()
  if (v === '') return null
  if (/^\s*(javascript|data|vbscript|file):/i.test(v)) throw new Error('Disallowed link type.')
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`
  let parsed
  try { parsed = new URL(candidate) } catch { throw new Error('Invalid URL.') }
  if (!parsed.hostname || !parsed.hostname.includes('.')) throw new Error('Incomplete URL.')
  return candidate
}

// Validate & normalise an array of image URLs (max 8)
function cleanImageUrls(arr) {
  if (arr === undefined) return undefined
  if (arr === null) return []
  if (!Array.isArray(arr)) throw new Error('image_urls must be an array.')
  if (arr.length > 8) throw new Error('Up to 8 images allowed.')
  return arr.map(u => {
    const c = cleanUrl(u)
    if (!c) throw new Error('Empty image URL.')
    return c
  })
}

// ── PUBLIC: list active businesses (student-facing "Local" browse) ──
// GET /businesses?category=food
router.get('/',
  [ query('category').optional().trim().isLength({ max: 60 }) ],
  check,
  async (req, res) => {
    const { category } = req.query
    try {
      const params = []
      let where = `status = 'active'`
      if (category && category !== 'all') {
        params.push(category)
        where += ` AND category = $${params.length}`
      }
      const { rows } = await pool.query(
        `SELECT businesses.business_id, businesses.name, category, description, address, map_hint,
                phone, whatsapp, email, hours, image_urls, logo_url, cover_image_url,
                link_url, public_code, businesses.created_at,
                (boosted_until IS NOT NULL AND boosted_until > NOW()) AS boosted,
                (SELECT ROUND(AVG(rating)::numeric,1) FROM business_reviews br WHERE br.business_id = businesses.business_id) AS avg_rating,
                (SELECT COUNT(*)::int FROM business_reviews br WHERE br.business_id = businesses.business_id) AS rating_count,
                l.name AS campus_zone, l.latitude, l.longitude
         FROM businesses
         LEFT JOIN locations l ON l.location_id = businesses.location_id
         WHERE ${where}
         ORDER BY (boosted_until IS NOT NULL AND boosted_until > NOW()) DESC, businesses.created_at DESC`, params)
      return res.status(200).json({ businesses: rows })
    } catch (err) {
      log.error('GET /businesses', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── PUBLIC: distinct categories that currently have active listings ──
// GET /businesses/categories
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT category, COUNT(*)::int AS count
       FROM businesses WHERE status = 'active'
       GROUP BY category ORDER BY category`)
    return res.status(200).json({ categories: rows })
  } catch (err) {
    log.error('GET /businesses/categories', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── ADMIN: list ALL businesses (any status) for the management view ──
// GET /businesses/admin/all
router.get('/admin/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM businesses ORDER BY created_at DESC`)
    return res.status(200).json({ businesses: rows })
  } catch (err) {
    log.error('GET /businesses/admin/all', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ════════════════════════════════════════════════════════════════════════════
//  BUSINESS-OWNER SELF-SERVICE  (the dashboard backend)
//  Authorised by OWNERSHIP (businesses.owner_id == req.userId), not role alone.
//  NOTE: these /mine routes MUST be declared before GET '/:id', or '/mine' would
//  be captured by the :id param and fail UUID validation.
// ════════════════════════════════════════════════════════════════════════════

// ── OWNER: my business (full record) ──
// GET /businesses/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT businesses.*,
              (boosted_until IS NOT NULL AND boosted_until > NOW()) AS boosted,
              (SELECT ROUND(AVG(rating)::numeric,1) FROM business_reviews br WHERE br.business_id = businesses.business_id) AS avg_rating,
              (SELECT COUNT(*)::int FROM business_reviews br WHERE br.business_id = businesses.business_id) AS rating_count,
              (SELECT COUNT(*)::int FROM follows WHERE target_type = 'business' AND target_id = businesses.business_id) AS follower_count,
              l.name AS campus_zone
         FROM businesses
         LEFT JOIN locations l ON l.location_id = businesses.location_id
        WHERE owner_id = $1 ORDER BY businesses.created_at ASC LIMIT 1`,
      [req.userId])
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No business is linked to your account yet.' })
    }
    return res.status(200).json({ business: rows[0] })
  } catch (err) {
    log.error('GET /businesses/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── OWNER: edit my page (whitelisted fields only) ──
// PATCH /businesses/mine
router.patch('/mine',
  requireAuth,
  [
    body('name').optional().trim().isLength({ min: 1, max: 160 }),
    body('category').optional().trim().isLength({ min: 1, max: 60 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('mapHint').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('whatsapp').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('email').optional({ nullable: true }).trim().isLength({ max: 160 }),
    body('hours').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('tagline').optional({ nullable: true }).trim().isLength({ max: 200 }),
    // A5: which zone the business is in, so Local can sort by proximity.
    // Empty string clears it; fail-open on a DB hiccup (see validateLocationName).
    body('campusZone').optional({ nullable: true }).trim().custom(validateLocationName),
  ],
  check,
  async (req, res) => {
    try {
      // Resolve the caller's business first (ownership gate).
      const owned = await pool.query('SELECT business_id FROM businesses WHERE owner_id = $1 LIMIT 1', [req.userId])
      if (owned.rows.length === 0) {
        return res.status(404).json({ message: 'No business is linked to your account yet.' })
      }
      const businessId = owned.rows[0].business_id

      const sets = []
      const vals = []
      let i = 1
      // Plain text fields from the whitelist.
      for (const [k, col] of Object.entries(OWNER_EDITABLE)) {
        if (req.body[k] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(req.body[k] === '' ? null : req.body[k]) }
      }
      // Validated/normalised fields.
      const theme = cleanHexColor(req.body.themeColor)
      if (theme !== undefined) { sets.push(`theme_color = $${i++}`); vals.push(theme) }
      if (req.body.coverImageUrl !== undefined) { sets.push(`cover_image_url = $${i++}`); vals.push(cleanUrl(req.body.coverImageUrl)) }
      if (req.body.linkUrl   !== undefined) { sets.push(`link_url = $${i++}`);   vals.push(cleanUrl(req.body.linkUrl)) }
      if (req.body.logoUrl   !== undefined) { sets.push(`logo_url = $${i++}`);   vals.push(cleanUrl(req.body.logoUrl)) }
      if (req.body.imageUrls !== undefined) { sets.push(`image_urls = $${i++}`); vals.push(cleanImageUrls(req.body.imageUrls)) }
      const socials = cleanSocials(req.body.socials)
      if (socials !== undefined) { sets.push(`socials = $${i++}`); vals.push(JSON.stringify(socials)) }
      if (req.body.campusZone !== undefined) {
        sets.push(`location_id = $${i++}`)
        vals.push(req.body.campusZone ? await resolveLocationId(req.body.campusZone) : null)
      }

      if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update.' })
      sets.push(`updated_at = NOW()`)
      vals.push(businessId)

      await pool.query(`UPDATE businesses SET ${sets.join(', ')} WHERE business_id = $${i}`, vals)
      // Re-select with the zone name joined in, so the response (and the
      // owner's live preview) reflects campus_zone the same way every other read does.
      const { rows } = await pool.query(
        `SELECT businesses.*, l.name AS campus_zone
           FROM businesses LEFT JOIN locations l ON l.location_id = businesses.location_id
          WHERE businesses.business_id = $1`, [businessId])
      return res.status(200).json({ business: rows[0] })
    } catch (err) {
      if (/URL|link|image|array|colour|social/i.test(err.message)) return res.status(422).json({ message: err.message })
      log.error('PATCH /businesses/mine', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER: my analytics ──
// GET /businesses/mine/analytics?days=30
router.get('/mine/analytics',
  requireAuth,
  [ query('days').optional().isInt({ min: 1, max: 365 }) ],
  check,
  async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365)
    try {
      const owned = await pool.query('SELECT business_id FROM businesses WHERE owner_id = $1 LIMIT 1', [req.userId])
      if (owned.rows.length === 0) {
        return res.status(404).json({ message: 'No business is linked to your account yet.' })
      }
      const businessId = owned.rows[0].business_id

      // Totals per event type over the window.
      const totalsQ = await pool.query(
        `SELECT event_type, COUNT(*)::int AS cnt
         FROM business_page_events
         WHERE business_id = $1
           AND created_at >= (CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')
         GROUP BY event_type`,
        [businessId, days])
      const totals = {}
      for (const r of totalsQ.rows) totals[r.event_type] = r.cnt

      // Daily 'view' series (zero-filled).
      const seriesQ = await pool.query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(c.cnt, 0)::int AS count
         FROM generate_series(
                (CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day'), CURRENT_DATE, INTERVAL '1 day'
              ) AS d(day)
         LEFT JOIN (
              SELECT date_trunc('day', created_at)::date AS day, COUNT(*) AS cnt
              FROM business_page_events
              WHERE business_id = $1 AND event_type = 'view'
                AND created_at >= (CURRENT_DATE - ($2::int - 1) * INTERVAL '1 day')
              GROUP BY 1
         ) c ON c.day = d.day::date
         ORDER BY d.day`,
        [businessId, days])

      const totalViews = totals.view || 0
      const totalClicks = (totals.phone_click || 0) + (totals.whatsapp_click || 0) +
                          (totals.email_click || 0) + (totals.link_click || 0) +
                          (totals.directions_click || 0)
      return res.status(200).json({
        business_id: businessId,
        range_days: days,
        totals,
        total_views: totalViews,
        total_clicks: totalClicks,
        engagement_rate: totalViews > 0 ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0,
        views_series: seriesQ.rows,
      })
    } catch (err) {
      log.error('GET /businesses/mine/analytics', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── PUBLIC: record a page event (view / click) ──
// POST /businesses/:id/events   body: { type }
// Unauthenticated + rate-limited. Only records for ACTIVE businesses; stores no PII.
router.post('/:id/events',
  eventsLimiter,
  [
    param('id').isUUID(),
    body('type').isIn(['view','phone_click','whatsapp_click','email_click','link_click','directions_click','image_view']),
  ],
  check,
  async (req, res) => {
    try {
      const biz = await pool.query(`SELECT status FROM businesses WHERE business_id = $1`, [req.params.id])
      if (biz.rows.length === 0 || biz.rows[0].status !== 'active') {
        // Don't reveal existence/status — just no-op for non-active/unknown.
        return res.status(204).end()
      }
      // Coarse referrer host only (never the full URL with query params).
      let referrerHost = null
      const ref = req.headers['referer'] || req.headers['referrer']
      if (ref) { try { referrerHost = new URL(ref).hostname.slice(0, 255) } catch { /* ignore */ } }

      await pool.query(
        `INSERT INTO business_page_events (business_id, event_type, referrer_host) VALUES ($1, $2, $3)`,
        [req.params.id, req.body.type, referrerHost])
      return res.status(204).end()
    } catch (err) {
      log.error('POST /businesses/:id/events', { reqId: req.id, msg: err.message })
      // Analytics must never break the page — swallow as a soft 204.
      return res.status(204).end()
    }
  }
)

// ── ADMIN: assign (or clear) the owner of a business ──
// PATCH /businesses/:id/owner   body: { ownerEmail }  (null/empty clears)
router.patch('/:id/owner',
  requireAuth, requireAdmin,
  [
    param('id').isUUID(),
    body('ownerEmail').optional({ nullable: true }).trim().isLength({ max: 255 }),
  ],
  check,
  async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let ownerId = null
      const email = (req.body.ownerEmail || '').trim()
      if (email) {
        const u = await client.query(
          `SELECT user_id, role FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`, [email])
        if (u.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ message: `No active user with email "${email}".` })
        }
        ownerId = u.rows[0].user_id
        // Promote to 'business' so the frontend routes them to the dashboard
        // (never downgrade an admin).
        if (u.rows[0].role !== 'admin') {
          await client.query(`UPDATE users SET role = 'business', updated_at = NOW() WHERE user_id = $1`, [ownerId])
        }
      }
      const { rows } = await client.query(
        `UPDATE businesses SET owner_id = $1, updated_at = NOW() WHERE business_id = $2 RETURNING *`,
        [ownerId, req.params.id])
      if (rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Business not found.' })
      }
      await client.query('COMMIT')
      return res.status(200).json({ business: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      log.error('PATCH /businesses/:id/owner', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// ── PUBLIC: single business detail ──
// GET /businesses/:id
// ── PUBLIC: resolve a business by its short public_code (QR / shareable link, E3/E2) ──
// GET /businesses/code/:code  →  { business_id, name }
router.get('/code/:code', [ param('code').trim().isLength({ min: 4, max: 12 }) ], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT business_id, name, status FROM businesses WHERE upper(public_code) = upper($1)`, [req.params.code])
    if (rows.length === 0 || rows[0].status !== 'active') return res.status(404).json({ message: 'Business not found.' })
    return res.status(200).json({ business_id: rows[0].business_id, name: rows[0].name })
  } catch (err) {
    log.error('GET /businesses/code/:code', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── PUBLIC: a business's reviews + aggregate (E1) ──
// GET /businesses/:id/reviews
router.get('/:id/reviews', [ param('id').isUUID() ], check, async (req, res) => {
  try {
    const [agg, list] = await Promise.all([
      pool.query('SELECT ROUND(AVG(rating)::numeric,1) AS avg_rating, COUNT(*)::int AS rating_count FROM business_reviews WHERE business_id = $1', [req.params.id]),
      pool.query(
        `SELECT r.review_id, r.rating, r.comment, r.created_at, up.display_name AS reviewer_name
           FROM business_reviews r LEFT JOIN user_profiles up ON up.user_id = r.reviewer_id
          WHERE r.business_id = $1 ORDER BY r.created_at DESC LIMIT 50`, [req.params.id]),
    ])
    return res.status(200).json({ avg_rating: agg.rows[0].avg_rating, rating_count: agg.rows[0].rating_count, reviews: list.rows })
  } catch (err) {
    log.error('GET /businesses/:id/reviews', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── CUSTOMER: leave/update a review (one per person per business, E1) ──
// POST /businesses/:id/reviews  { rating, comment? }
router.post('/:id/reviews',
  requireAuth,
  [ param('id').isUUID(), body('rating').isInt({ min: 1, max: 5 }), body('comment').optional({ nullable: true }).trim().isLength({ max: 2000 }) ],
  check,
  async (req, res) => {
    const comment = (req.body.comment || '').toString().trim().slice(0, 2000) || null
    if (rejectIfProfane(res, comment)) return
    try {
      const biz = await pool.query('SELECT owner_id, status, disabled_features FROM businesses WHERE business_id = $1', [req.params.id])
      const b = biz.rows[0]
      if (!b || b.status !== 'active') return res.status(404).json({ message: 'Business not found.' })
      if ((b.disabled_features || []).includes('reviews')) return res.status(403).json({ message: 'Reviews are turned off for this business.' })
      if (b.owner_id && b.owner_id === req.userId) return res.status(400).json({ message: "You can't review your own business." })
      const { rows } = await pool.query(
        `INSERT INTO business_reviews (business_id, reviewer_id, rating, comment) VALUES ($1,$2,$3,$4)
         ON CONFLICT (business_id, reviewer_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
         RETURNING *`, [req.params.id, req.userId, req.body.rating, comment])
      if (b.owner_id) createNotification({ userId: b.owner_id, type: 'business.review', title: 'New review', body: `Your business received a ${req.body.rating}-star review.`, referenceId: req.params.id }).catch(() => {})
      return res.status(201).json({ review: rows[0] })
    } catch (err) {
      log.error('POST /businesses/:id/reviews', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER: boost my business to promoted placement for 7 days (E4) ──
// POST /businesses/mine/boost  (free during beta; billing hooks in with payments/G1)
router.post('/mine/boost', requireAuth, async (req, res) => {
  try {
    const owned = await pool.query('SELECT business_id, disabled_features FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [req.userId])
    const b = owned.rows[0]
    if (!b) return res.status(403).json({ message: 'No business is linked to your account.' })
    if ((b.disabled_features || []).includes('boost')) return res.status(403).json({ message: 'Promotion is turned off for this business.' })
    const { rows } = await pool.query(
      `UPDATE businesses SET boosted_until = GREATEST(COALESCE(boosted_until, NOW()), NOW()) + INTERVAL '7 days', updated_at = NOW()
        WHERE business_id = $1 RETURNING boosted_until`, [b.business_id])
    return res.status(200).json({ boosted_until: rows[0].boosted_until })
  } catch (err) {
    log.error('POST /businesses/mine/boost', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ══ PRODUCT CATALOG (Batch 5) ══════════════════════════════════════════════
// A business owner lists products/services; the public sees the available ones on
// the profile. Writes are owner-scoped. NB: the /mine/products routes are declared
// BEFORE /:id/products so "mine" is never captured as a business id.
const MAX_PRODUCTS = 100

// Resolve the caller's own business id (or null). Mirrors the /mine pattern.
async function ownBusinessId(userId) {
  const { rows } = await pool.query(
    'SELECT business_id FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [userId])
  return rows[0]?.business_id || null
}
function serializeProduct(r) {
  return {
    product_id: r.product_id, business_id: r.business_id, name: r.name,
    description: r.description, price_cents: r.price_cents, image_url: r.image_url,
    is_available: r.is_available, sort_order: r.sort_order, created_at: r.created_at,
  }
}

// ── OWNER: my full catalog (includes unavailable items) ──
// GET /businesses/mine/products
router.get('/mine/products', requireAuth, async (req, res) => {
  try {
    const businessId = await ownBusinessId(req.userId)
    if (!businessId) return res.status(404).json({ message: 'No business is linked to your account yet.' })
    const { rows } = await pool.query(
      `SELECT * FROM business_products WHERE business_id = $1 ORDER BY sort_order ASC, created_at ASC`, [businessId])
    return res.status(200).json({ products: rows.map(serializeProduct) })
  } catch (err) {
    log.error('GET /businesses/mine/products', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── OWNER: add a catalog item ──
// POST /businesses/mine/products  { name, priceCents?, description?, imageUrl?, isAvailable?, sortOrder? }
router.post('/mine/products',
  requireAuth,
  [
    body('name').trim().isLength({ min: 1, max: 120 }),
    body('priceCents').optional({ nullable: true }).isInt({ min: 0, max: 100_000_000 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 600 }),
    body('imageUrl').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('isAvailable').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0, max: 100000 }),
  ],
  check,
  async (req, res) => {
    if (rejectIfProfane(res, `${req.body.name} ${req.body.description || ''}`)) return
    try {
      const businessId = await ownBusinessId(req.userId)
      if (!businessId) return res.status(404).json({ message: 'No business is linked to your account yet.' })
      const cnt = await pool.query('SELECT COUNT(*)::int AS n FROM business_products WHERE business_id = $1', [businessId])
      if (cnt.rows[0].n >= MAX_PRODUCTS) return res.status(422).json({ message: `Catalog limit reached (${MAX_PRODUCTS} items).` })
      const { rows } = await pool.query(
        `INSERT INTO business_products (business_id, name, description, price_cents, image_url, is_available, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [businessId,
         req.body.name.trim(),
         (req.body.description || '').trim() || null,
         req.body.priceCents ?? null,
         req.body.imageUrl ? cleanUrl(req.body.imageUrl) : null,
         req.body.isAvailable === undefined ? true : !!req.body.isAvailable,
         req.body.sortOrder ?? 0])
      return res.status(201).json({ product: serializeProduct(rows[0]) })
    } catch (err) {
      log.error('POST /businesses/mine/products', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER: edit a catalog item (must belong to my business) ──
// PATCH /businesses/mine/products/:productId
router.patch('/mine/products/:productId',
  requireAuth,
  [
    param('productId').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('priceCents').optional({ nullable: true }).isInt({ min: 0, max: 100_000_000 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 600 }),
    body('imageUrl').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('isAvailable').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0, max: 100000 }),
  ],
  check,
  async (req, res) => {
    if (rejectIfProfane(res, `${req.body.name || ''} ${req.body.description || ''}`)) return
    try {
      const businessId = await ownBusinessId(req.userId)
      if (!businessId) return res.status(404).json({ message: 'No business is linked to your account yet.' })
      const sets = [], vals = []
      let i = 1
      if (req.body.name !== undefined)        { sets.push(`name = $${i++}`);         vals.push(req.body.name.trim()) }
      if (req.body.description !== undefined)  { sets.push(`description = $${i++}`);  vals.push((req.body.description || '').trim() || null) }
      if (req.body.priceCents !== undefined)   { sets.push(`price_cents = $${i++}`);  vals.push(req.body.priceCents ?? null) }
      if (req.body.imageUrl !== undefined)     { sets.push(`image_url = $${i++}`);    vals.push(req.body.imageUrl ? cleanUrl(req.body.imageUrl) : null) }
      if (req.body.isAvailable !== undefined)  { sets.push(`is_available = $${i++}`); vals.push(!!req.body.isAvailable) }
      if (req.body.sortOrder !== undefined)    { sets.push(`sort_order = $${i++}`);   vals.push(req.body.sortOrder) }
      if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update.' })
      sets.push('updated_at = NOW()')
      vals.push(req.params.productId, businessId)
      const { rows } = await pool.query(
        `UPDATE business_products SET ${sets.join(', ')}
          WHERE product_id = $${i++} AND business_id = $${i} RETURNING *`, vals)
      if (rows.length === 0) return res.status(404).json({ message: 'Product not found.' })
      return res.status(200).json({ product: serializeProduct(rows[0]) })
    } catch (err) {
      log.error('PATCH /businesses/mine/products/:productId', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── OWNER: delete a catalog item (must belong to my business) ──
// DELETE /businesses/mine/products/:productId
router.delete('/mine/products/:productId',
  requireAuth, [ param('productId').isUUID() ], check,
  async (req, res) => {
    try {
      const businessId = await ownBusinessId(req.userId)
      if (!businessId) return res.status(404).json({ message: 'No business is linked to your account yet.' })
      const { rowCount } = await pool.query(
        'DELETE FROM business_products WHERE product_id = $1 AND business_id = $2', [req.params.productId, businessId])
      if (rowCount === 0) return res.status(404).json({ message: 'Product not found.' })
      return res.status(204).end()
    } catch (err) {
      log.error('DELETE /businesses/mine/products/:productId', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── PUBLIC: a business's available catalog ──
// GET /businesses/:id/products
router.get('/:id/products', [ param('id').isUUID() ], check, async (req, res) => {
  try {
    const biz = await pool.query('SELECT status FROM businesses WHERE business_id = $1', [req.params.id])
    if (biz.rows.length === 0 || biz.rows[0].status !== 'active') return res.status(404).json({ message: 'Business not found.' })
    const { rows } = await pool.query(
      `SELECT * FROM business_products WHERE business_id = $1 AND is_available = TRUE
        ORDER BY sort_order ASC, created_at ASC`, [req.params.id])
    return res.status(200).json({ products: rows.map(serializeProduct) })
  } catch (err) {
    log.error('GET /businesses/:id/products', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── ADMIN: toggle a business's feature switches (E5) ──
// PATCH /businesses/:id/features  { disabledFeatures: string[] }
router.patch('/:id/features', requireAuth, requireAdmin,
  [ param('id').isUUID(), body('disabledFeatures').isArray(), body('disabledFeatures.*').isIn(['deals', 'bookings', 'reviews', 'boost']) ],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        'UPDATE businesses SET disabled_features = $1, updated_at = NOW() WHERE business_id = $2 RETURNING business_id, disabled_features',
        [req.body.disabledFeatures, req.params.id])
      if (rows.length === 0) return res.status(404).json({ message: 'Business not found.' })
      return res.status(200).json({ business: rows[0] })
    } catch (err) {
      log.error('PATCH /businesses/:id/features', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

router.get('/:id',
  [ param('id').isUUID() ],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT businesses.business_id, businesses.name, category, description, address, map_hint,
                phone, whatsapp, email, hours, image_urls, logo_url, cover_image_url,
                link_url, status, public_code, businesses.created_at,
                (boosted_until IS NOT NULL AND boosted_until > NOW()) AS boosted,
                (SELECT ROUND(AVG(rating)::numeric,1) FROM business_reviews br WHERE br.business_id = businesses.business_id) AS avg_rating,
                (SELECT COUNT(*)::int FROM business_reviews br WHERE br.business_id = businesses.business_id) AS rating_count,
                l.name AS campus_zone, l.latitude, l.longitude
         FROM businesses
         LEFT JOIN locations l ON l.location_id = businesses.location_id
         WHERE businesses.business_id = $1`, [req.params.id])
      if (rows.length === 0) return res.status(404).json({ message: 'Business not found.' })
      // Only expose active ones publicly (admins use /admin/all for the rest)
      if (rows[0].status !== 'active') return res.status(404).json({ message: 'Business not found.' })
      return res.status(200).json({ business: rows[0] })
    } catch (err) {
      log.error('GET /businesses/:id', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── ADMIN: create a business ──
// POST /businesses
router.post('/',
  requireAuth, requireAdmin,
  [
    body('name').trim().isLength({ min: 1, max: 160 }),
    body('category').trim().isLength({ min: 1, max: 60 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('mapHint').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('whatsapp').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('email').optional({ nullable: true }).trim().isLength({ max: 160 }),
    body('hours').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('status').optional().isIn(['pending', 'active', 'expired']),
    body('feePaid').optional({ nullable: true }).isFloat({ min: 0 }),
    body('signedByRep').optional({ nullable: true }).trim().isLength({ max: 120 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('campusZone').optional({ nullable: true }).trim().custom(validateLocationName),
  ],
  check,
  async (req, res) => {
    try {
      const linkUrl = cleanUrl(req.body.linkUrl)
      const logoUrl = cleanUrl(req.body.logoUrl)
      const imageUrls = cleanImageUrls(req.body.imageUrls) || []
      const locationId = req.body.campusZone ? await resolveLocationId(req.body.campusZone) : null
      const b = req.body
      const { rows } = await pool.query(
        `INSERT INTO businesses
           (name, category, description, address, map_hint, phone, whatsapp, email,
            hours, image_urls, logo_url, link_url, status, fee_paid, paid_at,
            signed_by_rep, notes, public_code, location_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::numeric,
                 CASE WHEN $14::numeric IS NOT NULL THEN NOW() ELSE NULL END,$15,$16,
                 upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),$17)
         RETURNING *`,
        [b.name, b.category, b.description || null, b.address || null, b.mapHint || null,
         b.phone || null, b.whatsapp || null, b.email || null, b.hours || null,
         imageUrls, logoUrl, linkUrl, b.status || 'pending', b.feePaid ?? null,
         b.signedByRep || null, b.notes || null, locationId])
      return res.status(201).json({ business: rows[0] })
    } catch (err) {
      if (/URL|link|image|array/i.test(err.message)) return res.status(422).json({ message: err.message })
      log.error('POST /businesses', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── ADMIN: update a business ──
// PATCH /businesses/:id
router.patch('/:id',
  requireAuth, requireAdmin,
  [
    param('id').isUUID(),
    body('name').optional().trim().isLength({ min: 1, max: 160 }),
    body('category').optional().trim().isLength({ min: 1, max: 60 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('mapHint').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('whatsapp').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('email').optional({ nullable: true }).trim().isLength({ max: 160 }),
    body('hours').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('status').optional().isIn(['pending', 'active', 'expired']),
    body('feePaid').optional({ nullable: true }).isFloat({ min: 0 }),
    body('signedByRep').optional({ nullable: true }).trim().isLength({ max: 120 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('campusZone').optional({ nullable: true }).trim().custom(validateLocationName),
  ],
  check,
  async (req, res) => {
    try {
      const sets = []
      const vals = []
      let i = 1
      const map = {
        name: 'name', category: 'category', description: 'description', address: 'address',
        mapHint: 'map_hint', phone: 'phone', whatsapp: 'whatsapp', email: 'email',
        hours: 'hours', status: 'status', feePaid: 'fee_paid', signedByRep: 'signed_by_rep',
        notes: 'notes',
      }
      for (const [k, col] of Object.entries(map)) {
        if (req.body[k] !== undefined) { sets.push(`${col} = $${i++}`); vals.push(req.body[k] === '' ? null : req.body[k]) }
      }
      // URL/array fields run through the cleaners
      if (req.body.linkUrl  !== undefined) { sets.push(`link_url = $${i++}`); vals.push(cleanUrl(req.body.linkUrl)) }
      if (req.body.logoUrl  !== undefined) { sets.push(`logo_url = $${i++}`); vals.push(cleanUrl(req.body.logoUrl)) }
      if (req.body.imageUrls!== undefined) { sets.push(`image_urls = $${i++}`); vals.push(cleanImageUrls(req.body.imageUrls)) }
      if (req.body.campusZone !== undefined) {
        sets.push(`location_id = $${i++}`)
        vals.push(req.body.campusZone ? await resolveLocationId(req.body.campusZone) : null)
      }
      // when flipping to active and no paid_at yet, stamp it
      if (req.body.status === 'active') sets.push(`paid_at = COALESCE(paid_at, NOW())`)

      if (sets.length === 0) return res.status(400).json({ message: 'Nothing to update.' })
      sets.push(`updated_at = NOW()`)
      vals.push(req.params.id)

      const { rows } = await pool.query(
        `UPDATE businesses SET ${sets.join(', ')} WHERE business_id = $${i} RETURNING *`, vals)
      if (rows.length === 0) return res.status(404).json({ message: 'Business not found.' })
      return res.status(200).json({ business: rows[0] })
    } catch (err) {
      if (/URL|link|image|array/i.test(err.message)) return res.status(422).json({ message: err.message })
      log.error('PATCH /businesses/:id', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── ADMIN: delete a business ──
// DELETE /businesses/:id
router.delete('/:id',
  requireAuth, requireAdmin,
  [ param('id').isUUID() ],
  check,
  async (req, res) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM businesses WHERE business_id = $1', [req.params.id])
      if (rowCount === 0) return res.status(404).json({ message: 'Business not found.' })
      return res.status(200).json({ message: 'Business deleted.' })
    } catch (err) {
      log.error('DELETE /businesses/:id', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
