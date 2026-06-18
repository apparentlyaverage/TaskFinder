// server/routes/search.js — universal search across people, businesses, tasks.
// Public (no auth): it only returns information already exposed on public
// profiles, active business listings, and open tasks. Short queries return
// empty results rather than scanning the whole table.
import { Router } from 'express'
import { pool } from '../db.js'
import log from '../log.js'

const router = Router()
const PER_CATEGORY = 8

router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.status(200).json({ query: q, users: [], businesses: [], tasks: [] })
  const like = `%${q}%`
  try {
    const [users, businesses, tasks] = await Promise.all([
      pool.query(
        `SELECT u.user_id, up.display_name, up.avatar_url, up.headline,
                up.campus_zone, up.avg_rating, up.rating_count
         FROM users u JOIN user_profiles up ON u.user_id = up.user_id
         WHERE up.display_name ILIKE $1
            OR up.headline ILIKE $1
            OR COALESCE(array_to_string(up.skills, ','), '') ILIKE $1
         ORDER BY up.avg_rating DESC NULLS LAST, up.rating_count DESC
         LIMIT $2`, [like, PER_CATEGORY]),
      pool.query(
        `SELECT business_id, name, category, description, address
         FROM businesses
         WHERE status = 'active'
           AND (name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1)
         ORDER BY name LIMIT $2`, [like, PER_CATEGORY]),
      pool.query(
        `SELECT t.task_id, t.title, t.budget, t.status, t.skill_tags,
                up.display_name AS creator_name
         FROM tasks t LEFT JOIN user_profiles up ON t.creator_id = up.user_id
         WHERE t.status = 'open'
           AND (t.title ILIKE $1 OR t.description ILIKE $1
                OR COALESCE(array_to_string(t.skill_tags, ','), '') ILIKE $1)
         ORDER BY t.created_at DESC LIMIT $2`, [like, PER_CATEGORY]),
    ])
    return res.status(200).json({
      query: q,
      users: users.rows,
      businesses: businesses.rows,
      tasks: tasks.rows,
    })
  } catch (err) {
    log.error('search.failed', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
