// server/routes/profile.js — user profile management
// Handles: read own profile, update bio/skills/portfolio/display_name,
//          change password. All routes require a valid JWT.
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import { requireAuth } from '../middleware.js'

const router = Router()
const SALT_ROUNDS = 12

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// GET /profile — full profile of the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.email, u.role, u.google_id, u.google_avatar_url,
              u.is_email_verified, u.is_ru_student,
              up.display_name, up.bio, up.skills, up.portfolio_url, up.campus_zone,
              up.avatar_url, up.avg_rating, up.rating_count,
              up.headline, up.services_offered, up.pinned_task_ids, up.featured_review_id
       FROM users u
       LEFT JOIN user_profiles up ON u.user_id = up.user_id
       WHERE u.user_id = $1`,
      [req.userId]
    )
    if (rows.length === 0) return res.status(404).json({ message: 'Profile not found.' })
    // Old accounts may lack a user_profiles row — create one on the fly
    if (rows[0].display_name === null && rows[0].bio === null) {
      await pool.query(
        'INSERT INTO user_profiles (user_id, display_name) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING',
        [req.userId, rows[0].email?.split('@')[0] || 'User']
      ).catch(() => {})
    }
    return res.status(200).json({ profile: rows[0] })
  } catch (err) {
    console.error('[GET /profile]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// PATCH /profile — update editable profile fields
// Accepts any subset of: displayName, bio, skills, portfolioUrl, campusZone,
// phoneNumber, headline, servicesOffered, pinnedTaskIds, featuredReviewId
router.patch('/',
  requireAuth,
  [
    body('displayName').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('bio').optional({ nullable: true }).trim().isLength({ max: 1000 }),
    body('portfolioUrl').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('campusZone').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('phoneNumber').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('headline').optional({ nullable: true }).trim().isLength({ max: 120 }),
    body('servicesOffered').optional({ nullable: true }).trim().isLength({ max: 1500 }),
    body('pinnedTaskIds').optional({ nullable: true }).isArray({ max: 6 }),
    body('featuredReviewId').optional({ nullable: true }),
  ],
  check,
  async (req, res) => {
    const { displayName, bio, portfolioUrl, campusZone, phoneNumber,
            headline, servicesOffered, pinnedTaskIds, featuredReviewId } = req.body

    // Skills can arrive as an array or a comma-separated string — normalise to array
    let skills
    if (req.body.skills !== undefined) {
      skills = Array.isArray(req.body.skills)
        ? req.body.skills
        : String(req.body.skills).split(',').map(s => s.trim()).filter(Boolean)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Build the user_profiles UPDATE dynamically from only the provided fields
      const sets = []
      const vals = []
      let i = 1
      if (displayName     !== undefined) { sets.push(`display_name = $${i++}`);    vals.push(displayName) }
      if (bio             !== undefined) { sets.push(`bio = $${i++}`);             vals.push(bio) }
      if (skills          !== undefined) { sets.push(`skills = $${i++}`);          vals.push(skills) }
      if (portfolioUrl    !== undefined) { sets.push(`portfolio_url = $${i++}`);   vals.push(portfolioUrl) }
      if (campusZone      !== undefined) { sets.push(`campus_zone = $${i++}`);     vals.push(campusZone) }
      if (headline        !== undefined) { sets.push(`headline = $${i++}`);        vals.push(headline) }
      if (servicesOffered !== undefined) { sets.push(`services_offered = $${i++}`); vals.push(servicesOffered) }
      if (pinnedTaskIds   !== undefined) { sets.push(`pinned_task_ids = $${i++}`); vals.push(pinnedTaskIds) }
      if (featuredReviewId!== undefined) { sets.push(`featured_review_id = $${i++}`); vals.push(featuredReviewId) }

      if (sets.length > 0) {
        sets.push(`updated_at = NOW()`)
        vals.push(req.userId)
        await client.query(
          `UPDATE user_profiles SET ${sets.join(', ')} WHERE user_id = $${i}`,
          vals
        )
      }

      // phone_number lives on the users table (best-effort — column may be absent)
      if (phoneNumber !== undefined) {
        await client.query('UPDATE users SET phone_number = $1 WHERE user_id = $2', [phoneNumber, req.userId])
          .catch(() => {})
      }

      await client.query('COMMIT')

      // Return the fresh, merged profile so the frontend can update in place
      const { rows } = await pool.query(
        `SELECT u.user_id, u.email, u.role, u.google_avatar_url,
                up.display_name, up.bio, up.skills, up.portfolio_url,
                up.campus_zone, up.avatar_url, up.avg_rating, up.rating_count
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.user_id = $1`,
        [req.userId]
      )
      return res.status(200).json({ profile: rows[0], message: 'Profile updated.' })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[PATCH /profile]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// PATCH /profile/password — change password (email accounts only)
router.patch('/password',
  requireAuth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  check,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body
    try {
      const { rows } = await pool.query(
        'SELECT password_hash, google_id FROM users WHERE user_id = $1',
        [req.userId]
      )
      if (rows.length === 0) return res.status(404).json({ message: 'User not found.' })

      const user = rows[0]
      // Google-only accounts have no password to change
      if (!user.password_hash) {
        return res.status(400).json({
          message: 'Your account uses Google Sign-In, so it has no password to change.',
        })
      }

      const ok = await bcrypt.compare(currentPassword, user.password_hash)
      if (!ok) return res.status(401).json({ message: 'Current password is incorrect.' })

      const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [newHash, req.userId]
      )
      return res.status(200).json({ message: 'Password changed successfully.' })
    } catch (err) {
      console.error('[PATCH /profile/password]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /profile/public/:userId — PUBLIC profile: identity, rating, and task history.
// No auth required — this is what other members see when they tap a name.
router.get('/public/:userId',
  [param('userId').isUUID()],
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
    next()
  },
  async (req, res) => {
    const { userId } = req.params
    try {
      // Identity + showcase fields + verification (best-effort on new columns)
      const profileQ = pool.query(
        `SELECT u.user_id, u.role, u.created_at AS joined_at, u.google_avatar_url,
                u.is_email_verified, u.is_ru_student, u.google_id,
                up.display_name, up.bio, up.skills, up.campus_zone,
                up.avatar_url, up.avg_rating, up.rating_count,
                up.headline, up.services_offered, up.pinned_task_ids, up.featured_review_id
         FROM users u
         LEFT JOIN user_profiles up ON u.user_id = up.user_id
         WHERE u.user_id = $1`, [userId])

      const postedQ = pool.query(
        `SELECT task_id, title, budget, status, skill_tags, created_at
         FROM tasks WHERE creator_id = $1
         ORDER BY created_at DESC LIMIT 20`, [userId])

      const completedQ = pool.query(
        `SELECT task_id, title, budget, skill_tags, updated_at
         FROM tasks WHERE assigned_to = $1 AND status = 'completed'
         ORDER BY updated_at DESC LIMIT 20`, [userId])

      const reviewsQ = pool.query(
        `SELECT r.review_id, r.rating, r.comment, r.role, r.created_at,
                up.display_name AS reviewer_name, t.title AS task_title
         FROM reviews r
         JOIN user_profiles up ON r.reviewer_id = up.user_id
         JOIN tasks t ON r.task_id = t.task_id
         WHERE r.reviewee_id = $1
         ORDER BY r.created_at DESC LIMIT 20`, [userId])

      // Trust stats — all derived from existing tables, no new columns needed.
      //  - tasks_posted / tasks_completed: counts
      //  - completion_rate: of tasks assigned to them, how many reached 'completed'
      //  - response_rate: of distinct people who messaged them first, how many they replied to
      const statsQ = pool.query(
        `SELECT
           (SELECT COUNT(*) FROM tasks WHERE creator_id = $1)::int AS tasks_posted,
           (SELECT COUNT(*) FROM tasks WHERE assigned_to = $1 AND status = 'completed')::int AS tasks_completed,
           (SELECT COUNT(*) FROM tasks WHERE assigned_to = $1)::int AS tasks_assigned,
           (SELECT COUNT(DISTINCT sender_id) FROM messages WHERE receiver_id = $1)::int AS inbound_senders,
           (SELECT COUNT(DISTINCT m1.sender_id) FROM messages m1
              WHERE m1.receiver_id = $1
                AND EXISTS (SELECT 1 FROM messages m2
                            WHERE m2.sender_id = $1 AND m2.receiver_id = m1.sender_id))::int AS replied_senders`,
        [userId])

      const [profile, posted, completed, reviews, stats] =
        await Promise.all([profileQ, postedQ, completedQ, reviewsQ, statsQ])

      if (profile.rows.length === 0) return res.status(404).json({ message: 'User not found.' })

      const s = stats.rows[0]
      const completionRate = s.tasks_assigned > 0
        ? Math.round((s.tasks_completed / s.tasks_assigned) * 100) : null
      const responseRate = s.inbound_senders > 0
        ? Math.round((s.replied_senders / s.inbound_senders) * 100) : null

      const prof = profile.rows[0]
      // Verification badges the UI can render
      const badges = []
      if (prof.is_email_verified) badges.push('email_verified')
      if (prof.is_ru_student)     badges.push('ru_student')
      if (prof.google_id)         badges.push('google_linked')
      if (s.tasks_completed >= 10) badges.push('established')           // 10+ completed
      if (prof.rating_count >= 5 && Number(prof.avg_rating) >= 4.5) badges.push('top_rated')

      // Best-effort: bump profile view counter (never blocks the response)
      pool.query('UPDATE user_profiles SET profile_views = COALESCE(profile_views,0) + 1 WHERE user_id = $1', [userId]).catch(() => {})

      return res.status(200).json({
        profile: prof,
        counts: {
          tasks_posted:    s.tasks_posted,
          tasks_completed: s.tasks_completed,
        },
        stats: {
          completion_rate: completionRate,   // % or null if no assigned tasks
          response_rate:   responseRate,      // % or null if never messaged
        },
        badges,
        posted:    posted.rows,
        completed: completed.rows,
        reviews:   reviews.rows,
      })
    } catch (err) {
      console.error('[GET /profile/public]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

export default router
