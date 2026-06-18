// server/scripts/seed-admin.mjs — create (or reset) an admin account with a
// known password, so there's a working admin login during the pre-launch lock.
//
//   npm run seed-admin <email> [password]
//
// If no password is given, a strong one is generated and printed. The account
// is created with role=admin and POPIA consent recorded. Idempotent: re-running
// for an existing email promotes it to admin and resets the password.
//
// SECURITY: the printed password is shown ONCE. Change it after first login.
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const SALT_ROUNDS = 12
const POPIA_CONSENT_VERSION = '2026-06-v1'

const email = (process.argv[2] || '').trim().toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Usage: npm run seed-admin <email> [password]')
  process.exit(1)
}

// A readable-but-strong default if none supplied: RelivR-<8 hex>!
const password = process.argv[3] || `RelivR-${crypto.randomBytes(4).toString('hex')}!`
const displayName = email.split('@')[0]

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  await client.query('BEGIN')

  const existing = await client.query('SELECT user_id FROM users WHERE lower(email) = $1', [email])
  let userId
  if (existing.rows.length > 0) {
    userId = existing.rows[0].user_id
    await client.query(
      `UPDATE users
          SET role = 'admin', password_hash = $1, suspended_at = NULL, deleted_at = NULL,
              token_version = token_version + 1,
              popia_consent = TRUE, popia_consent_at = COALESCE(popia_consent_at, NOW()),
              popia_consent_version = COALESCE(popia_consent_version, $2),
              updated_at = NOW()
        WHERE user_id = $3`,
      [hash, POPIA_CONSENT_VERSION, userId])
    // Make sure a profile row exists.
    await client.query(
      `INSERT INTO user_profiles (user_id, display_name)
       VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
      [userId, displayName])
    console.log(`✓ Existing account promoted to admin and password reset.`)
  } else {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, role, is_email_verified,
         popia_consent, popia_consent_at, popia_consent_version)
       VALUES ($1, $2, 'admin', TRUE, TRUE, NOW(), $3)
       RETURNING user_id`,
      [email, hash, POPIA_CONSENT_VERSION])
    userId = rows[0].user_id
    await client.query(
      `INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)`,
      [userId, displayName])
    console.log(`✓ New admin account created.`)
  }

  await client.query('COMMIT')
  console.log('────────────────────────────────────────')
  console.log('  ADMIN LOGIN')
  console.log('  Email:    ', email)
  console.log('  Password: ', password)
  console.log('────────────────────────────────────────')
  console.log('  Sign in at /  →  you land on the admin dashboard.')
  console.log('  Change this password after first login.')
} catch (err) {
  await client.query('ROLLBACK')
  console.error('✗ Failed to seed admin:', err.message)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
