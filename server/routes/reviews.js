// server/routes/reviews.js — reviews (merged from services/reviews)
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { createNotification } from '../notify.js'
import { requireAuth } from '../middleware.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

async function recalculateRating(client, userId) {
  const { rows } = await client.query(
    'SELECT ROUND(AVG(rating)::NUMERIC,1) AS avg_rating, COUNT(*) AS rating_count FROM reviews WHERE reviewee_id=$1',
    [userId])
  await client.query(
    'UPDATE user_profiles SET avg_rating=$1, rating_count=$2 WHERE user_id=$3',
    [rows[0].avg_rating || 0, rows[0].rating_count, userId])
}

// POST /reviews
router.post('/',
  requireAuth,
  [
    body('task_id').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().trim().isLength({ max: 2000 })
      .withMessage('Comment must be 2000 characters or fewer.'),
  ],
  check,
  async (req, res) => {
    const { task_id, rating, comment = null } = req.body
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskResult = await client.query(
        'SELECT task_id, creator_id, assigned_to, status, title FROM tasks WHERE task_id=$1', [task_id])
      if (taskResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Task not found.' })
      }
      const task = taskResult.rows[0]
      if (task.status !== 'completed') {
        await client.query('ROLLBACK')
        return res.status(409).json({ message: 'Task not completed yet.' })
      }
      let revieweeId, role
      if (task.creator_id === req.userId)      { revieweeId = task.assigned_to; role = 'creator' }
      else if (task.assigned_to === req.userId){ revieweeId = task.creator_id;  role = 'earner' }
      else {
        await client.query('ROLLBACK')
        return res.status(403).json({ message: 'You were not a participant in this task.' })
      }
      // Guard against self-review (e.g. a task whose creator is also the assignee).
      if (!revieweeId || revieweeId === req.userId) {
        await client.query('ROLLBACK')
        return res.status(400).json({ message: 'You cannot review yourself.' })
      }
      const { rows } = await client.query(
        'INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating, comment, role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [task_id, req.userId, revieweeId, rating, comment, role])
      await recalculateRating(client, revieweeId)
      await client.query('COMMIT')

      createNotification({
        userId: revieweeId,
        type: 'review.received',
        title: 'You received a review',
        body: `You got ${rating} star${rating !== 1 ? 's' : ''} on "${task.title}".`,
        referenceId: task_id,
      })

      return res.status(201).json({ review: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') return res.status(409).json({ message: 'You already reviewed this task.' })
      log.error('POST /reviews', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// GET /reviews/user/:userId
router.get('/user/:userId', [param('userId').isUUID()], check, async (req, res) => {
  const { userId } = req.params
  try {
    const [reviews, summary] = await Promise.all([
      pool.query(
        `SELECT r.*, up.display_name AS reviewer_name, t.title AS task_title
         FROM reviews r
         JOIN user_profiles up ON r.reviewer_id = up.user_id
         JOIN tasks t ON r.task_id = t.task_id
         WHERE r.reviewee_id = $1 ORDER BY r.created_at DESC LIMIT 20`, [userId]),
      pool.query('SELECT avg_rating, rating_count FROM user_profiles WHERE user_id=$1', [userId]),
    ])
    return res.status(200).json({ summary: summary.rows[0], reviews: reviews.rows })
  } catch (err) {
    log.error('GET /reviews/user', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
