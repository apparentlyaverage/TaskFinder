// server/db.js — single shared Postgres pool for all routes
import pg from 'pg'
import log from './log.js'
const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Neon free tier connection limit headroom
})

pool.on('error', (err) => log.error('db.idle_client_error', { msg: err.message }))
