// server/db.js — single shared Postgres pool for all routes
import pg from 'pg'
const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Neon free tier connection limit headroom
})

pool.on('error', (err) => console.error('[db] idle client error', err.message))
