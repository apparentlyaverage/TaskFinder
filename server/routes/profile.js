// server/routes/profile.js — user profile management
// Handles: read own profile, update bio/skills/portfolio/display_name,
//          change password. All routes require a valid JWT.
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
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
              up.display_name, up.bio, up.skills, up.portfolio_url, up.campus_zone,
              up.avatar_url, up.avg_rating, up.rating_count
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
// Accepts any subset of: displayName, bio, skills (array OR comma string),
// portfolioUrl, campusZone, phoneNumber
router.patch('/',
  requireAuth,
  [
    body('displayName').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('bio').optional({ nullable: true }).trim().isLength({ max: 1000 }),
    body('portfolioUrl').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('campusZone').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('phoneNumber').optional({ nullable: true }).trim().isLength({ max: 20 }),
  ],
  check,
  async (req, res) => {
    const { displayName, bio, portfolioUrl, campusZone, phoneNumber } = req.body

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
      if (displayName  !== undefined) { sets.push(`display_name = $${i++}`);  vals.push(displayName) }
      if (bio          !== undefined) { sets.push(`bio = $${i++}`);           vals.push(bio) }
      if (skills       !== undefined) { sets.push(`skills = $${i++}`);        vals.push(skills) }
      if (portfolioUrl !== undefined) { sets.push(`portfolio_url = $${i++}`); vals.push(portfolioUrl) }
      if (campusZone   !== undefined) { sets.push(`campus_zone = $${i++}`);   vals.push(campusZone) }

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

export default router
