// server/routes/messages.js — messages + notifications (merged from services/messaging)
// Socket.io removed for MVP — the frontend polls GET /messages/:userId and
// GET /notifications every ~10s. pushToUser() and the RabbitMQ consumers are
// gone; notifications are created directly by the routes that trigger them.
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { createNotification } from '../notify.js'
import { requireAuth } from '../middleware.js'
import { rejectIfProfane } from '../profanity.js'

const router = Router()

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// POST /messages — send a message
router.post('/messages',
  requireAuth,
  [body('receiver_id').isUUID(), body('content').trim().notEmpty().isLength({ max: 2000 })],
  check,
  async (req, res) => {
    const { receiver_id, task_id = null, content } = req.body
    if (req.userId === receiver_id) return res.status(400).json({ message: 'Cannot message yourself.' })
    if (rejectIfProfane(res, content)) return
    try {
      const { rows } = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, task_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
        [req.userId, receiver_id, task_id, content]
      )
      // In-app + email notification for the recipient (best-effort).
      createNotification({
        userId: receiver_id,
        type: 'message.received',
        title: 'New message',
        body: 'You have a new message on ReLivR.',
        referenceId: req.userId,
      })
      return res.status(201).json({ message: rows[0] })
    } catch (err) {
      log.error('POST /messages', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /messages/threads — list conversations (one row per counterpart)
router.get('/messages/threads', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (other_id)
              other_id, up.display_name, up.avatar_url, m.content AS last_message, m.created_at
       FROM (
         SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS other_id,
                content, created_at
         FROM messages
         WHERE sender_id = $1 OR receiver_id = $1
         ORDER BY created_at DESC
       ) m
       LEFT JOIN user_profiles up ON up.user_id = m.other_id
       ORDER BY other_id, m.created_at DESC`,
      [req.userId]
    )
    return res.status(200).json({ threads: rows })
  } catch (err) {
    log.error('GET /messages/threads', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// GET /messages/:userId — conversation with one user (marks their msgs read)
router.get('/messages/:userId',
  requireAuth,
  [param('userId').isUUID()],
  check,
  async (req, res) => {
    const them = req.params.userId
    const { limit = 50 } = req.query
    try {
      const { rows } = await pool.query(
        `SELECT * FROM messages
         WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
         ORDER BY created_at DESC LIMIT $3`,
        [req.userId, them, limit]
      )
      // Mark their messages read — best-effort, must not break the load
      pool.query(
        'UPDATE messages SET is_read=TRUE, read_at=NOW() WHERE receiver_id=$1 AND sender_id=$2 AND is_read=FALSE',
        [req.userId, them]
      ).catch(() => {})
      return res.status(200).json({ messages: rows.reverse() })
    } catch (err) {
      log.error('GET /messages/:userId', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// GET /notifications
router.get('/notifications', requireAuth, async (req, res) => {
  const { unread_only = false, limit = 20 } = req.query
  try {
    const query = unread_only === 'true'
      ? 'SELECT * FROM notifications WHERE user_id=$1 AND is_read=FALSE ORDER BY created_at DESC LIMIT $2'
      : 'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2'
    const { rows } = await pool.query(query, [req.userId, limit])
    const count = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE', [req.userId])
    return res.status(200).json({ notifications: rows, unread_count: parseInt(count.rows[0].count) })
  } catch (err) {
    log.error('GET /notifications', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// PATCH /notifications/read — mark all read
router.patch('/notifications/read', requireAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read=TRUE, read_at=NOW() WHERE user_id=$1 AND is_read=FALSE',
      [req.userId])
    return res.status(200).json({ message: 'All notifications marked as read.' })
  } catch (err) {
    log.error('PATCH /notifications/read', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
