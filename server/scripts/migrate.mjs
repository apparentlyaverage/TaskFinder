// server/scripts/migrate.mjs — apply db/init/*.sql to DATABASE_URL (TD-12).
// There is no psql in the dev environment, so this gives a `npm run migrate`
// path. Runs every schema file in order; the early (01–06) files are not
// idempotent, so an "already exists" error on an existing DB is logged and
// skipped. The newer migrations (07, 08) use IF NOT EXISTS and run cleanly.
//
// Usage:  npm run migrate            (all files)
//         node scripts/migrate.mjs 07 08   (only files whose name contains 07/08)
import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const initDir  = join(repoRoot, 'db', 'init')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set (check server/.env). Aborting.')
  process.exit(1)
}

const filter = process.argv.slice(2)
const files = readdirSync(initDir)
  .filter(f => f.endsWith('.sql'))
  .filter(f => filter.length === 0 || filter.some(p => f.includes(p)))
  .sort()

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

let applied = 0, skipped = 0
try {
  for (const file of files) {
    const sql = readFileSync(join(initDir, file), 'utf8')
    try {
      await pool.query(sql)
      console.log(`✓ applied ${file}`)
      applied++
    } catch (err) {
      if (/already exists|duplicate/i.test(err.message)) {
        console.log(`• skipped ${file} (already applied: ${err.message})`)
        skipped++
      } else {
        console.error(`✗ failed ${file}: ${err.message}`)
        throw err
      }
    }
  }
  console.log(`\nDone. ${applied} applied, ${skipped} skipped.`)
} finally {
  await pool.end()
}
