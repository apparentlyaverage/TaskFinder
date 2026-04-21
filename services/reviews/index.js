// services/reviews/index.js
import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { body, param, validationResult } from 'express-validator'

const { Pool } = pg
const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

async function recalculateRating(client, userId) {
  const { rows } = await client.query(
    'SELECT ROUND(AVG(rating)::NUMERIC,1) AS avg_rating, COUNT(*) AS rating_count FROM reviews WHERE reviewee_id=$1', [userId]
  )
  await client.query('UPDATE user_profiles SET avg_rating=$1, rating_count=$2 WHERE user_id=$3', [rows[0].avg_rating || 0, rows[0].rating_count, userId])
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// POST /reviews
app.post('/reviews',
  [body('task_id').isUUID(), body('rating').isInt({ min: 1, max: 5 }), body('comment').optional().trim()],
  handleValidation,
  async (req, res) => {
    const { task_id, rating, comment = null } = req.body
    const reviewerId = req.headers['x-user-id']
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const taskResult = await client.query('SELECT task_id, creator_id, assigned_to, status FROM tasks WHERE task_id=$1', [task_id])
      if (taskResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Task not found.' }) }
      const task = taskResult.rows[0]
      if (task.status !== 'completed') { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Task not completed.' }) }
      let revieweeId, role
      if (task.creator_id === reviewerId) { revieweeId = task.assigned_to; role = 'creator' }
      else if (task.assigned_to === reviewerId) { revieweeId = task.creator_id; role = 'earner' }
      else { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Not a participant.' }) }
      const { rows } = await client.query(
        'INSERT INTO reviews (task_id,reviewer_id,reviewee_id,rating,comment,role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [task_id, reviewerId, revieweeId, rating, comment, role]
      )
      await recalculateRating(client, revieweeId)
      await client.query('COMMIT')
      return res.status(201).json({ review: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      if (err.code === '23505') return res.status(409).json({ message: 'Already reviewed.' })
      console.error('[POST /reviews]', err.message)
      return res.status(500).json({ message: 'Internal server error.' })
    } finally {
      client.release()
    }
  }
)

// GET /reviews/user/:userId
app.get('/reviews/user/:userId', [param('userId').isUUID()], handleValidation, async (req, res) => {
  const { userId } = req.params
  try {
    const [reviews, summary] = await Promise.all([
      pool.query('SELECT r.*, up.display_name AS reviewer_name, t.title AS task_title FROM reviews r JOIN user_profiles up ON r.reviewer_id=up.user_id JOIN tasks t ON r.task_id=t.task_id WHERE r.reviewee_id=$1 ORDER BY r.created_at DESC LIMIT 20', [userId]),
      pool.query('SELECT avg_rating, rating_count FROM user_profiles WHERE user_id=$1', [userId]),
    ])
    return res.status(200).json({ summary: summary.rows[0], reviews: reviews.rows })
  } catch (err) {
    console.error('[GET /reviews]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

const PORT = process.env.PORT || 3006
app.listen(PORT, () => console.log(`Reviews service running on port ${PORT}`))