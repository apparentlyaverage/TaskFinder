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
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'

const router = Router()

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
        `SELECT business_id, name, category, description, address, map_hint,
                phone, whatsapp, email, hours, image_urls, logo_url, link_url, created_at
         FROM businesses
         WHERE ${where}
         ORDER BY created_at DESC`, params)
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

// ── PUBLIC: single business detail ──
// GET /businesses/:id
router.get('/:id',
  [ param('id').isUUID() ],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT business_id, name, category, description, address, map_hint,
                phone, whatsapp, email, hours, image_urls, logo_url, link_url, status, created_at
         FROM businesses WHERE business_id = $1`, [req.params.id])
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
  ],
  check,
  async (req, res) => {
    try {
      const linkUrl = cleanUrl(req.body.linkUrl)
      const logoUrl = cleanUrl(req.body.logoUrl)
      const imageUrls = cleanImageUrls(req.body.imageUrls) || []
      const b = req.body
      const { rows } = await pool.query(
        `INSERT INTO businesses
           (name, category, description, address, map_hint, phone, whatsapp, email,
            hours, image_urls, logo_url, link_url, status, fee_paid, paid_at,
            signed_by_rep, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::numeric,
                 CASE WHEN $14::numeric IS NOT NULL THEN NOW() ELSE NULL END,$15,$16)
         RETURNING *`,
        [b.name, b.category, b.description || null, b.address || null, b.mapHint || null,
         b.phone || null, b.whatsapp || null, b.email || null, b.hours || null,
         imageUrls, logoUrl, linkUrl, b.status || 'pending', b.feePaid ?? null,
         b.signedByRep || null, b.notes || null])
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
