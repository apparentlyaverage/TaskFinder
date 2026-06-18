// server/scripts/make-admin.mjs — promote a user to admin (ops tooling, §7.8).
// No admin features are usable without an admin account, and there's no UI to
// grant one (by design — it's a privileged action).
//
//   npm run make-admin you@example.com
//   npm run make-admin you@example.com member   # demote back to member
import 'dotenv/config'
import pg from 'pg'

const email = process.argv[2]
const role = process.argv[3] || 'admin'
if (!email) {
  console.error('Usage: npm run make-admin <email> [role=admin]')
  process.exit(1)
}
if (!['admin', 'member', 'creator', 'earner'].includes(role)) {
  console.error(`Invalid role "${role}". Use one of: admin, member, creator, earner.`)
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const { rows } = await pool.query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE lower(email) = lower($2) AND deleted_at IS NULL RETURNING user_id, email, role',
    [role, email])
  if (rows.length === 0) {
    console.error(`No active user found with email "${email}".`)
    process.exit(1)
  }
  console.log(`✓ ${rows[0].email} is now "${rows[0].role}". They must sign out and back in for it to take effect.`)
} finally {
  await pool.end()
}
