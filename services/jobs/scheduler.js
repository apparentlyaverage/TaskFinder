// services/jobs/scheduler.js
import 'dotenv/config'
import pg from 'pg'
import cron from 'node-cron'
import amqplib from 'amqplib'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let channel = null

async function connectMQ() {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL)
    channel = await conn.createChannel()
    await channel.assertExchange('taskfinder.events', 'topic', { durable: true })
    console.log('[scheduler] RabbitMQ connected')
  } catch (err) {
    console.error('[scheduler] RabbitMQ failed:', err.message)
    setTimeout(connectMQ, 5000)
  }
}

function publish(key, payload) {
  if (channel) channel.publish('taskfinder.events', key, Buffer.from(JSON.stringify(payload)), { persistent: true })
}

async function logJobStart(jobName) {
  const { rows } = await pool.query("INSERT INTO job_audit_log (job_name, status) VALUES ($1,'started') RETURNING log_id", [jobName])
  return rows[0].log_id
}

async function logJobComplete(logId, records) {
  await pool.query("UPDATE job_audit_log SET status='completed', records_affected=$1, completed_at=NOW() WHERE log_id=$2", [records, logId])
}

async function logJobFailed(logId, error) {
  await pool.query("UPDATE job_audit_log SET status='failed', error_message=$1, completed_at=NOW() WHERE log_id=$2", [error, logId])
}

async function expireStaleTasksJob() {
  const logId = await logJobStart('expire_stale_tasks')
  try {
    const { rows } = await pool.query("UPDATE tasks SET status='expired' WHERE status='open' AND deadline < NOW() RETURNING task_id, creator_id, title")
    for (const task of rows) publish('task.expired', { taskId: task.task_id, creatorId: task.creator_id, taskTitle: task.title })
    await logJobComplete(logId, rows.length)
    console.log(`[scheduler] expired ${rows.length} tasks`)
  } catch (err) {
    await logJobFailed(logId, err.message)
  }
}

async function cleanOrphanedMatchesJob() {
  const logId = await logJobStart('clean_orphaned_matches')
  try {
    const { rowCount } = await pool.query("DELETE FROM task_matches WHERE task_id IN (SELECT task_id FROM tasks WHERE status != 'open')")
    await logJobComplete(logId, rowCount)
  } catch (err) {
    await logJobFailed(logId, err.message)
  }
}

async function purgeOldNotificationsJob() {
  const logId = await logJobStart('purge_old_notifications')
  const days = parseInt(process.env.NOTIFICATION_RETENTION_DAYS || '90')
  try {
    const { rowCount } = await pool.query("DELETE FROM notifications WHERE is_read=TRUE AND created_at < NOW() - ($1 || ' days')::INTERVAL", [days])
    await logJobComplete(logId, rowCount)
  } catch (err) {
    await logJobFailed(logId, err.message)
  }
}

async function start() {
  await connectMQ()
  cron.schedule('0 * * * *',   expireStaleTasksJob)
  cron.schedule('0 2 * * *',   cleanOrphanedMatchesJob)
  cron.schedule('0 4 * * 0',   purgeOldNotificationsJob)
  console.log('[scheduler] All jobs registered')
}

start()