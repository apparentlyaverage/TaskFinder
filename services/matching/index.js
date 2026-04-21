// services/matching/index.js
import 'dotenv/config'
import express from 'express'
import pg from 'pg'
import { connect as connectMQ, subscribe, publish } from './eventBus.js'

const { Pool } = pg
const app = express()
app.use(express.json())
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const MAX_MATCHES = parseInt(process.env.MAX_MATCHES_PER_TASK || '20')
const MIN_SCORE   = parseFloat(process.env.MIN_MATCH_SCORE || '0.25')

function jaccardScore(taskTags, earnerSkills) {
  if (!taskTags?.length || !earnerSkills?.length) return 0
  const taskSet   = new Set(taskTags.map(s => s.toLowerCase().trim()))
  const earnerSet = new Set(earnerSkills.map(s => s.toLowerCase().trim()))
  let intersection = 0
  for (const s of earnerSet) if (taskSet.has(s)) intersection++
  return intersection / (taskSet.size + earnerSet.size - intersection)
}

async function runMatchingForTask(taskId, taskTags) {
  if (!taskTags?.length) return 0
  const { rows } = await pool.query(
    "SELECT u.user_id, up.skills, up.avg_rating FROM users u JOIN user_profiles up ON u.user_id=up.user_id WHERE u.role='earner' AND up.skills && $1::TEXT[] AND up.skills IS NOT NULL",
    [taskTags]
  )
  if (!rows.length) return 0
  const scored = rows
    .map(e => {
      const base    = jaccardScore(taskTags, e.skills)
      const bonus   = Math.max(0, (parseFloat(e.avg_rating) || 0 - 3) * 0.10)
      return { userId: e.user_id, score: Math.min(1.0, base + base * bonus) }
    })
    .filter(e => e.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MATCHES)
  if (!scored.length) return 0
  const values = scored.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ')
  const params  = [taskId]
  scored.forEach(e => params.push(e.userId, e.score.toFixed(2)))
  await pool.query(
    `INSERT INTO task_matches (task_id, earner_id, score) VALUES ${values} ON CONFLICT (task_id, earner_id) DO UPDATE SET score = EXCLUDED.score`,
    params
  )
  for (const match of scored) publish('task.matched', { taskId, earnerId: match.userId, score: match.score })
  return scored.length
}

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.get('/matching/suggestions', async (req, res) => {
  const userId = req.headers['x-user-id']
  const { limit = 10 } = req.query
  try {
    const { rows } = await pool.query(
      "SELECT t.*, tm.score AS match_score FROM task_matches tm JOIN tasks t ON tm.task_id=t.task_id WHERE tm.earner_id=$1 AND t.status='open' AND t.deadline > NOW() ORDER BY tm.score DESC, t.created_at DESC LIMIT $2",
      [userId, limit]
    )
    return res.status(200).json({ suggestions: rows })
  } catch (err) {
    console.error('[suggestions]', err.message)
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

async function startConsumers() {
  await connectMQ()
  await subscribe('task.created', 'matching.task.created', async (p) => {
    const count = await runMatchingForTask(p.taskId, p.skillTags)
    console.log(`[matching] Matched ${count} earners for task ${p.taskId}`)
  })
}

const PORT = process.env.PORT || 3005
app.listen(PORT, async () => {
  await startConsumers()
  console.log(`Matching service running on port ${PORT}`)
})

export { runMatchingForTask }