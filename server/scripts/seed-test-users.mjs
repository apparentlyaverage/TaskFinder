// server/scripts/seed-test-users.mjs — create 30 test logins for QA.
//
//   npm run seed:test-users
//
// Creates (idempotently):
//   • 10 BUSINESS owners (role='business'), each linked to an active business
//     that is pre-populated with appearance fields + ~30 days of page-event
//     analytics, so the business dashboard has real data to show.
//   • 20 STUDENT accounts (role='member').
//
// Passwords are written to  <Documents>/RELIVR_TEST_LOGINS.md  (OUTSIDE the repo,
// so plaintext test credentials are never committed to git). Re-running resets
// the passwords to the freshly-generated ones and rewrites the doc.
//
// All emails use the reserved @relivr.test domain so they are easy to find and
// purge later:  DELETE FROM users WHERE email LIKE '%@relivr.test';
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SALT_ROUNDS = 12
const POPIA_VERSION = '1.0'

// Readable, unique, typeable passwords e.g. "Pixel-4821-9af3".
const WORDS = ['Brave','Clever','Swift','Lunar','Solar','Mango','Pixel','Cobalt',
               'Zephyr','Quartz','Amber','Indigo','Maple','Onyx','Coral','Jade']
function genPassword() {
  const w = WORDS[crypto.randomInt(WORDS.length)]
  return `${w}-${crypto.randomInt(1000, 9999)}-${crypto.randomBytes(2).toString('hex')}`
}

// ── The 10 business listings (each becomes one owner account) ─────────────────
const BUSINESSES = [
  { name: 'Bean There Coffee',      category: 'Food & Drink', tagline: 'Your daily grind, sorted.',        theme: '#6F4E37', hours: 'Mon–Sat 7am–6pm' },
  { name: 'Pita Pit Express',       category: 'Food & Drink', tagline: 'Fresh, fast, filled.',             theme: '#E2725B', hours: 'Daily 10am–10pm' },
  { name: 'The Study Den',          category: 'Food & Drink', tagline: '24-hour study café & snacks.',     theme: '#2E4053', hours: 'Open 24 hours' },
  { name: 'Campus Cuts Barber',     category: 'Services',     tagline: 'Sharp fades between lectures.',     theme: '#1C2833', hours: 'Mon–Sat 9am–7pm' },
  { name: 'QuickFix Phone Repair',  category: 'Services',     tagline: 'Cracked screen? Same-day fix.',     theme: '#2980B9', hours: 'Mon–Fri 9am–5pm' },
  { name: 'Makhanda Print & Copy',  category: 'Services',     tagline: 'Print, bind, submit. Done.',        theme: '#117A65', hours: 'Mon–Fri 8am–6pm' },
  { name: 'Fresh Threads Laundry',  category: 'Services',     tagline: 'Wash, dry, fold — campus pickup.',  theme: '#5DADE2', hours: 'Mon–Sat 8am–8pm' },
  { name: 'The Book Nook',          category: 'Retail',       tagline: 'Second-hand textbooks & novels.',   theme: '#884EA0', hours: 'Mon–Sat 9am–5pm' },
  { name: 'Pedal Power Bikes',      category: 'Services',     tagline: 'Repairs, rentals, spares.',         theme: '#D68910', hours: 'Tue–Sat 9am–6pm' },
  { name: 'Slice Pizzeria',         category: 'Food & Drink', tagline: 'Wood-fired, student-priced.',       theme: '#C0392B', hours: 'Daily 11am–11pm' },
]

const STUDENT_NAMES = [
  'Thabo Mokoena','Aisha Patel','Liam van der Merwe','Nomsa Dlamini','Kyle Petersen',
  'Zanele Khumalo','Ryan Naidoo','Lerato Mahlangu','Sipho Ndlovu','Chloe Botha',
  'Tariq Adams','Palesa Sithole','Daniel Smith','Amahle Zulu','Jordan Fourie',
  'Naledi Moloi','Ethan Daniels','Boitumelo Tau','Hannah Coetzee','Sibusiso Mthembu',
]

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// Insert/refresh a user; returns user_id. Idempotent on email.
async function upsertUser(client, { email, password, role, displayName }) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, role, is_verified, is_email_verified,
                        popia_consent, popia_consent_at, popia_consent_version)
     VALUES ($1, $2, $3, TRUE, TRUE, TRUE, NOW(), $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = EXCLUDED.role,
           deleted_at    = NULL,
           suspended_at  = NULL,
           locked_until  = NULL,
           failed_login_attempts = 0,
           updated_at    = NOW()
     RETURNING user_id`,
    [email.toLowerCase(), hash, role, POPIA_VERSION])
  const userId = rows[0].user_id
  await client.query(
    `INSERT INTO user_profiles (user_id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [userId, displayName])
  return userId
}

// Create/refresh a business owned by ownerId. Idempotent on (name).
async function upsertBusiness(client, ownerId, b) {
  const images = [
    `https://picsum.photos/seed/${encodeURIComponent(b.name)}-1/800/500`,
    `https://picsum.photos/seed/${encodeURIComponent(b.name)}-2/800/500`,
  ]
  const cover = `https://picsum.photos/seed/${encodeURIComponent(b.name)}-cover/1200/400`
  const socials = JSON.stringify({
    instagram: '@' + b.name.toLowerCase().replace(/[^a-z]+/g, ''),
    website: 'https://example.com',
  })
  const existing = await client.query('SELECT business_id FROM businesses WHERE name = $1', [b.name])
  if (existing.rows.length > 0) {
    const id = existing.rows[0].business_id
    await client.query(
      `UPDATE businesses SET owner_id=$1, category=$2, tagline=$3, theme_color=$4, hours=$5,
              status='active', cover_image_url=$6, image_urls=$7, socials=$8::jsonb,
              description=$9, updated_at=NOW()
       WHERE business_id=$10`,
      [ownerId, b.category, b.tagline, b.theme, b.hours, cover, images, socials,
       `${b.name} — ${b.tagline} A founding ReLivR local partner near campus.`, id])
    return id
  }
  const { rows } = await client.query(
    `INSERT INTO businesses
       (name, category, description, tagline, theme_color, hours, phone, whatsapp,
        image_urls, cover_image_url, socials, status, owner_id, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'active',$12, NOW())
     RETURNING business_id`,
    [b.name, b.category, `${b.name} — ${b.tagline} A founding ReLivR local partner near campus.`,
     b.tagline, b.theme, b.hours, '046 000 0000', '27600000000',
     images, cover, socials, ownerId])
  return rows[0].business_id
}

// Seed ~30 days of page events for a business — only if it has none yet.
// businessId (a DB-generated UUID) and event_type (from a fixed allowlist) are
// inlined as literals; NOW()/random() evaluate in-DB so timestamps spread
// realistically across each day. No user input is interpolated.
async function seedEvents(client, businessId) {
  const have = await client.query('SELECT 1 FROM business_page_events WHERE business_id = $1 LIMIT 1', [businessId])
  if (have.rows.length > 0) return 0
  const clickTypes = ['phone_click','whatsapp_click','email_click','link_click','directions_click']
  const ts = d => `NOW() - INTERVAL '${d} days' - (random() * INTERVAL '12 hours')`
  const rows = []
  for (let d = 29; d >= 0; d--) {
    const views = crypto.randomInt(3, 40)
    for (let v = 0; v < views; v++) rows.push(`('${businessId}', 'view', ${ts(d)})`)
    const clicks = crypto.randomInt(0, Math.max(1, Math.floor(views / 4)))
    for (let c = 0; c < clicks; c++) {
      rows.push(`('${businessId}', '${clickTypes[crypto.randomInt(clickTypes.length)]}', ${ts(d)})`)
    }
  }
  for (let i = 0; i < rows.length; i += 500) {  // chunk to keep statements bounded
    await client.query(
      `INSERT INTO business_page_events (business_id, event_type, created_at) VALUES ${rows.slice(i, i + 500).join(', ')}`)
  }
  return rows.length
}

const accounts = []   // collected for the markdown doc

const client = await pool.connect()
try {
  await client.query('BEGIN')

  // 10 business owners
  for (let i = 0; i < BUSINESSES.length; i++) {
    const n = String(i + 1).padStart(2, '0')
    const email = `biz${n}@relivr.test`
    const password = genPassword()
    const b = BUSINESSES[i]
    const userId = await upsertUser(client, { email, password, role: 'business', displayName: b.name })
    const bizId = await upsertBusiness(client, userId, b)
    const evCount = await seedEvents(client, bizId)
    accounts.push({ group: 'Business', email, password, label: b.name, extra: `${evCount} events seeded` })
  }

  // 20 students
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const n = String(i + 1).padStart(2, '0')
    const email = `student${n}@relivr.test`
    const password = genPassword()
    const name = STUDENT_NAMES[i]
    await upsertUser(client, { email, password, role: 'member', displayName: name })
    accounts.push({ group: 'Student', email, password, label: name, extra: '' })
  }

  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  console.error('Seed failed, rolled back:', err.message)
  await pool.end()
  process.exit(1)
} finally {
  client.release()
}
await pool.end()

// ── Write the credentials doc OUTSIDE the repo ───────────────────────────────
const docsDir = join(process.env.USERPROFILE || process.env.HOME || '.', 'OneDrive', 'Documents')
const outPath = join(docsDir, 'RELIVR_TEST_LOGINS.md')

const biz = accounts.filter(a => a.group === 'Business')
const students = accounts.filter(a => a.group === 'Student')
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

const md = `# ReLivR — Test Logins

> Generated ${stamp} by \`npm run seed:test-users\`.
> **Do not commit this file.** These are throwaway QA accounts on the live (beta-gated) database.
> All use the reserved \`@relivr.test\` domain. To remove them all later:
> \`DELETE FROM users WHERE email LIKE '%@relivr.test';\`

The app is pre-launch gated until **7 July 2026**. Business and student accounts can sign in;
the gate only blocks the main app surface for non-admins before launch, so use these for
dashboard/QA testing of the surfaces that are open.

## 🏢 Business owners (10) — sign in to see the **Business Dashboard**
Each owns an active, pre-populated business listing with ~30 days of analytics.

| # | Business | Email | Password |
|---|----------|-------|----------|
${biz.map((a, i) => `| ${i + 1} | ${a.label} | \`${a.email}\` | \`${a.password}\` |`).join('\n')}

## 🎓 Students (20) — regular marketplace accounts
| # | Name | Email | Password |
|---|------|-------|----------|
${students.map((a, i) => `| ${i + 1} | ${a.label} | \`${a.email}\` | \`${a.password}\` |`).join('\n')}

---
*Passwords are randomly generated each run. Re-running \`npm run seed:test-users\` resets them and rewrites this file.*
`

writeFileSync(outPath, md, 'utf8')
console.log(`\n✓ Seeded ${accounts.length} test accounts (${biz.length} business + ${students.length} student).`)
console.log(`✓ Credentials written to: ${outPath}`)
console.log(`  (Outside the repo — not tracked by git.)`)
