// seed-biz01-showcase.mjs — populate biz01@relivr.test so every new feature is
// visible on login: recurring + one-off Campus Deals, deal redemptions (→ the
// Client History dashboard), and followers (→ the dashboard follower count +
// the public Follow button). Idempotent: clears biz01's prior deals/redemptions
// + follows targeting biz01, then re-seeds. Run:  node scripts/seed-biz01-showcase.mjs
import 'dotenv/config'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const PIC = (s) => `https://picsum.photos/seed/${encodeURIComponent(s)}/800/500`

async function main() {
  // 1. Resolve biz01 + its business.
  const owner = (await pool.query("SELECT user_id FROM users WHERE email = 'biz01@relivr.test'")).rows[0]
  if (!owner) throw new Error('biz01@relivr.test not found — run seed:test-users first.')
  const biz = (await pool.query('SELECT business_id, name FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [owner.user_id])).rows[0]
  if (!biz) throw new Error('No business linked to biz01.')
  const students = (await pool.query(
    "SELECT user_id FROM users WHERE email LIKE 'student%@relivr.test' AND deleted_at IS NULL ORDER BY email LIMIT 8")).rows.map(r => r.user_id)
  if (students.length < 4) throw new Error('Need ≥4 student accounts — run seed:test-users first.')
  console.log(`biz: ${biz.name} (${biz.business_id}) · students: ${students.length}`)

  // 2. Clean prior showcase data for an idempotent re-run.
  await pool.query('DELETE FROM deal_redemptions WHERE business_id = $1', [biz.business_id])
  await pool.query("DELETE FROM follows WHERE target_type = 'business' AND target_id = $1", [biz.business_id])
  await pool.query('DELETE FROM campus_deals WHERE business_id = $1', [biz.business_id])

  // 3. Deals — a weekly recurring, a daily recurring, and a one-off.
  const deal = async (d) => (await pool.query(
    `INSERT INTO campus_deals
       (business_id, business_owner_id, title, description, image_url, price_cents,
        original_price_cents, status, expires_at, recurrence, active_window_s)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active', NOW() + ($8||' seconds')::interval, $9, $10)
     RETURNING deal_id`,
    [biz.business_id, owner.user_id, d.title, d.desc, d.img, d.price, d.was, d.windowS, d.rec, d.windowS]
  )).rows[0].deal_id

  const dealIds = []
  dealIds.push(await deal({ title: '½-price filter coffee', desc: 'Every week — show this at the till for 50% off any filter coffee.', img: PIC('bean-deal-coffee'), price: 1500, was: 3000, rec: 'weekly', windowS: 7 * 86400 }))
  dealIds.push(await deal({ title: 'Free muffin with any large coffee', desc: 'Daily special — one free muffin when you buy a large coffee.', img: PIC('bean-deal-muffin'), price: null, was: null, rec: 'daily', windowS: 86400 }))
  dealIds.push(await deal({ title: 'Student combo: coffee + toastie', desc: 'Coffee + a cheese toastie for R45. This week only.', img: PIC('bean-deal-combo'), price: 4500, was: 6500, rec: 'none', windowS: 3 * 86400 }))
  console.log(`deals: ${dealIds.length} (weekly, daily, one-off)`)

  // 4. Followers — the first 8 students follow biz01.
  for (const s of students) {
    await pool.query(
      "INSERT INTO follows (follower_id, target_type, target_id) VALUES ($1,'business',$2) ON CONFLICT DO NOTHING",
      [s, biz.business_id])
  }
  console.log(`followers: ${students.length}`)

  // 5. Redemptions — 12 across the deals, spread over ~24 days. students[0..3]
  //    redeem twice (repeat customers). Distinct daysAgo per row → no clash with
  //    the (deal, customer, day) unique index.
  const amounts = [1500, null, 4500]
  let n = 0
  for (let i = 0; i < 12; i++) {
    const dealIdx = i % 3
    const cust = students[i % 8]
    const daysAgo = i * 2
    await pool.query(
      `INSERT INTO deal_redemptions (deal_id, business_id, customer_id, amount_cents, redeemed_at, redeemed_date)
       VALUES ($1,$2,$3,$4, NOW() - ($5||' days')::interval, (NOW() - ($5||' days')::interval)::date)
       ON CONFLICT DO NOTHING`,
      [dealIds[dealIdx], biz.business_id, cust, amounts[dealIdx], daysAgo])
    n++
  }
  console.log(`redemptions: ${n} (8 unique customers, 4 repeat)`)
  console.log('✓ biz01 showcase seeded — log in as biz01@relivr.test to view Deals / Clients / followers.')
}

main().then(() => pool.end()).catch(err => { console.error(err.message); pool.end(); process.exit(1) })
