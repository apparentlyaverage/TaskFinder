// server/routes/follows.js — the social graph (§7.11.1).
//
// A logged-in user follows another USER or a BUSINESS. Polymorphic target so one
// table + one feed covers both. Existence of the target is checked here (the
// polymorphic target_id can't be a hard FK).
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'
import { createNotification } from '../notify.js'

const router = Router()
router.use(requireAuth) // following is a signed-in action; counts/state need the viewer

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// Confirm the follow target exists (and resolve who to notify). Returns
// { ok, notifyUserId } — notifyUserId is the user to ping on a new follow
// (the user themselves, or a business's owner), or null.
async function resolveTarget(targetType, targetId) {
  if (targetType === 'user') {
    const { rows } = await pool.query('SELECT user_id FROM users WHERE user_id = $1 AND deleted_at IS NULL', [targetId])
    return rows.length ? { ok: true, notifyUserId: targetId } : { ok: false }
  }
  // business
  const { rows } = await pool.query('SELECT owner_id FROM businesses WHERE business_id = $1', [targetId])
  return rows.length ? { ok: true, notifyUserId: rows[0].owner_id || null } : { ok: false }
}

// ── Follow a user or business ──
// POST /follows   { targetType, targetId }
router.post('/',
  [body('targetType').isIn(['user', 'business']), body('targetId').isUUID()],
  check,
  async (req, res) => {
    const { targetType, targetId } = req.body
    if (targetType === 'user' && targetId === req.userId) {
      return res.status(400).json({ message: "You can't follow yourself." })
    }
    try {
      const t = await resolveTarget(targetType, targetId)
      if (!t.ok) return res.status(404).json({ message: 'That account no longer exists.' })
      const { rowCount } = await pool.query(
        `INSERT INTO follows (follower_id, target_type, target_id) VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`, [req.userId, targetType, targetId])
      // Only notify on a genuinely new follow (rowCount === 1), never self.
      if (rowCount === 1 && t.notifyUserId && t.notifyUserId !== req.userId) {
        createNotification({
          userId: t.notifyUserId, type: 'follow.new',
          title: 'You have a new follower',
          body: targetType === 'business' ? 'Someone followed your business on ReLivR.' : 'Someone started following you on ReLivR.',
          referenceId: req.userId,
        }).catch(() => {})
      }
      return res.status(201).json({ following: true })
    } catch (err) {
      log.error('POST /follows', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── Unfollow ──
// DELETE /follows/:type/:id
router.delete('/:type/:id',
  [param('type').isIn(['user', 'business']), param('id').isUUID()],
  check,
  async (req, res) => {
    try {
      await pool.query('DELETE FROM follows WHERE follower_id = $1 AND target_type = $2 AND target_id = $3',
        [req.userId, req.params.type, req.params.id])
      return res.status(200).json({ following: false })
    } catch (err) {
      log.error('DELETE /follows', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── Favourite / un-favourite a target (a starred follow, for quick re-hiring) ──
// PATCH /follows/:type/:id/favourite  { favourite: bool }  — favouriting follows too.
router.patch('/:type/:id/favourite',
  [param('type').isIn(['user', 'business']), param('id').isUUID(), body('favourite').isBoolean()],
  check,
  async (req, res) => {
    const fav = !!req.body.favourite
    const { type, id } = req.params
    if (type === 'user' && id === req.userId) {
      return res.status(400).json({ message: "You can't favourite yourself." })
    }
    try {
      const t = await resolveTarget(type, id)
      if (!t.ok) return res.status(404).json({ message: 'That account no longer exists.' })
      // Favouriting implies following: upsert the edge and set the flag.
      await pool.query(
        `INSERT INTO follows (follower_id, target_type, target_id, favourite) VALUES ($1, $2, $3, $4)
         ON CONFLICT (follower_id, target_type, target_id) DO UPDATE SET favourite = EXCLUDED.favourite`,
        [req.userId, type, id, fav])
      return res.status(200).json({ following: true, favourite: fav })
    } catch (err) {
      log.error('PATCH /follows/favourite', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── Follow state for the current viewer + a target (drives the Follow button) ──
// GET /follows/state/:type/:id  →  { following, favourite, followers }
router.get('/state/:type/:id',
  [param('type').isIn(['user', 'business']), param('id').isUUID()],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND target_type = $2 AND target_id = $3) AS following,
                COALESCE((SELECT favourite FROM follows WHERE follower_id = $1 AND target_type = $2 AND target_id = $3), FALSE) AS favourite,
                (SELECT COUNT(*) FROM follows WHERE target_type = $2 AND target_id = $3)::int AS followers`,
        [req.userId, req.params.type, req.params.id])
      return res.status(200).json(rows[0])
    } catch (err) {
      log.error('GET /follows/state', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── My following feed (users + businesses I follow) ──
// GET /follows/me
router.get('/me', async (req, res) => {
  try {
    const [users, businesses] = await Promise.all([
      pool.query(
        `SELECT f.target_id AS user_id, up.display_name, up.avatar_url, f.favourite, f.created_at
           FROM follows f LEFT JOIN user_profiles up ON up.user_id = f.target_id
          WHERE f.follower_id = $1 AND f.target_type = 'user'
          ORDER BY f.favourite DESC, f.created_at DESC`, [req.userId]),
      pool.query(
        `SELECT f.target_id AS business_id, b.name, b.logo_url, b.category, b.status, f.favourite, f.created_at
           FROM follows f LEFT JOIN businesses b ON b.business_id = f.target_id
          WHERE f.follower_id = $1 AND f.target_type = 'business'
          ORDER BY f.favourite DESC, f.created_at DESC`, [req.userId]),
    ])
    return res.status(200).json({ users: users.rows, businesses: businesses.rows })
  } catch (err) {
    log.error('GET /follows/me', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
