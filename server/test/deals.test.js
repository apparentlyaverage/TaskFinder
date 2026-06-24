// Campus Deals: public active-only read, owner-scoped CRUD, admin moderation,
// and the critical expiry guard (active filter is in the SQL + past expiry is
// rejected at create).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const BIZ   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const DEAL  = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ownerToken = authToken({ userId: OWNER, role: 'business' })
const otherToken = authToken({ userId: OTHER, role: 'business' })
const adminToken = authToken({ userId: 'admin-1', role: 'admin' })

const future = new Date(Date.now() + 7 * 86400000).toISOString()
const past   = new Date(Date.now() - 86400000).toISOString()

beforeEach(() => vi.clearAllMocks())

describe('GET /deals (public)', () => {
  it('returns deals and enforces active+unexpired in the SQL', async () => {
    let sql = ''
    mockDb(pool, s => { if (/FROM campus_deals/.test(s)) { sql = s; return { rows: [{ deal_id: DEAL, title: 'Half-price coffee' }] } } })
    const res = await request(app).get('/deals')
    expect(res.status).toBe(200)
    expect(res.body.deals).toHaveLength(1)
    // The safety guarantee: expiry is filtered at query time on the DB clock.
    expect(sql).toMatch(/status = 'active'/)
    expect(sql).toMatch(/expires_at > NOW\(\)/)
  })
  it('rejects a non-UUID campus filter (422)', async () => {
    mockDb(pool)
    const res = await request(app).get('/deals?campus=notauuid')
    expect(res.status).toBe(422)
  })
})

describe('GET /deals/:id (public)', () => {
  it('404s for an expired/unknown deal (filtered by the same active guard)', async () => {
    mockDb(pool, s => { if (/FROM campus_deals/.test(s)) return { rows: [] } })
    const res = await request(app).get(`/deals/${DEAL}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /deals/mine (owner)', () => {
  it('401s without a token', async () => {
    const res = await request(app).get('/deals/mine')
    expect(res.status).toBe(401)
  })
  it('403s when no business is linked', async () => {
    mockDb(pool, s => { if (/FROM businesses WHERE owner_id/.test(s)) return { rows: [] } })
    const res = await request(app).get('/deals/mine').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
  })
  it('returns the owner\'s deals (200)', async () => {
    mockDb(pool, s => {
      if (/FROM businesses WHERE owner_id/.test(s)) return { rows: [{ business_id: BIZ }] }
      if (/FROM campus_deals WHERE business_id/.test(s)) return { rows: [{ deal_id: DEAL, status: 'expired' }] }
    })
    const res = await request(app).get('/deals/mine').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.deals[0].status).toBe('expired') // owners see expired ones too
  })
})

describe('POST /deals (owner)', () => {
  function setup() {
    mockDb(pool, s => {
      if (/FROM businesses WHERE owner_id/.test(s)) return { rows: [{ business_id: BIZ }] }
      if (/INSERT INTO campus_deals/.test(s)) return { rows: [{ deal_id: DEAL, title: 'Deal', status: 'active' }] }
    })
  }
  it('creates a deal (201)', async () => {
    setup()
    const res = await request(app).post('/deals').set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: '2-for-1 burgers', priceCents: 4500, expiresAt: future })
    expect(res.status).toBe(201)
    expect(res.body.deal.deal_id).toBe(DEAL)
  })
  it('rejects a past expiry date (422)', async () => {
    setup()
    const res = await request(app).post('/deals').set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Stale deal', expiresAt: past })
    expect(res.status).toBe(422)
  })
  it('rejects a missing title (422)', async () => {
    setup()
    const res = await request(app).post('/deals').set('Authorization', `Bearer ${ownerToken}`)
      .send({ expiresAt: future })
    expect(res.status).toBe(422)
  })
  it('403s when the caller owns no business', async () => {
    mockDb(pool, s => { if (/FROM businesses WHERE owner_id/.test(s)) return { rows: [] } })
    const res = await request(app).post('/deals').set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'x', expiresAt: future })
    expect(res.status).toBe(403)
  })
})

describe('PATCH /deals/:id (owner own / admin any)', () => {
  it('lets the owner edit their own deal (200)', async () => {
    mockDb(pool, s => {
      if (/SELECT business_owner_id FROM campus_deals/.test(s)) return { rows: [{ business_owner_id: OWNER }] }
      if (/^UPDATE campus_deals SET/.test(s.trim())) return { rows: [{ deal_id: DEAL, title: 'New' }] }
    })
    const res = await request(app).patch(`/deals/${DEAL}`).set('Authorization', `Bearer ${ownerToken}`).send({ title: 'New' })
    expect(res.status).toBe(200)
  })
  it('forbids editing someone else\'s deal (403)', async () => {
    mockDb(pool, s => { if (/SELECT business_owner_id FROM campus_deals/.test(s)) return { rows: [{ business_owner_id: OWNER }] } })
    const res = await request(app).patch(`/deals/${DEAL}`).set('Authorization', `Bearer ${otherToken}`).send({ title: 'Hijack' })
    expect(res.status).toBe(403)
  })
  it('lets an admin moderate any deal (200)', async () => {
    mockDb(pool, s => {
      if (/SELECT business_owner_id FROM campus_deals/.test(s)) return { rows: [{ business_owner_id: OWNER }] }
      if (/^UPDATE campus_deals SET/.test(s.trim())) return { rows: [{ deal_id: DEAL, status: 'archived' }] }
    })
    const res = await request(app).patch(`/deals/${DEAL}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'archived' })
    expect(res.status).toBe(200)
  })
  it('404s for an unknown deal', async () => {
    mockDb(pool, s => { if (/SELECT business_owner_id FROM campus_deals/.test(s)) return { rows: [] } })
    const res = await request(app).patch(`/deals/${DEAL}`).set('Authorization', `Bearer ${ownerToken}`).send({ title: 'x' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /deals/:id', () => {
  it('forbids deleting another owner\'s deal (403)', async () => {
    mockDb(pool, s => { if (/SELECT business_owner_id FROM campus_deals/.test(s)) return { rows: [{ business_owner_id: OWNER }] } })
    const res = await request(app).delete(`/deals/${DEAL}`).set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(403)
  })
  it('lets the owner delete their own (200)', async () => {
    mockDb(pool, s => { if (/SELECT business_owner_id FROM campus_deals/.test(s)) return { rows: [{ business_owner_id: OWNER }] } })
    const res = await request(app).delete(`/deals/${DEAL}`).set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /deals/admin/all (admin)', () => {
  it('forbids non-admins (403)', async () => {
    mockDb(pool)
    const res = await request(app).get('/deals/admin/all').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
  })
  it('returns all deals for an admin (200)', async () => {
    mockDb(pool, s => { if (/FROM campus_deals d JOIN businesses/.test(s)) return { rows: [{ deal_id: DEAL }] } })
    const res = await request(app).get('/deals/admin/all').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.deals).toHaveLength(1)
  })
})

describe('POST /deals/:id/redeem (customer)', () => {
  const activeDeal = (owner = OWNER) => ({ deal_id: DEAL, business_id: BIZ, business_owner_id: owner, price_cents: 4500, status: 'active', expires_at: future })
  it('401s without a token', async () => {
    const res = await request(app).post(`/deals/${DEAL}/redeem`)
    expect(res.status).toBe(401)
  })
  it('records a redemption (201)', async () => {
    let inserted = false
    mockDb(pool, s => {
      if (/SELECT deal_id, business_id, business_owner_id/.test(s)) return { rows: [activeDeal()] }
      if (/INSERT INTO deal_redemptions/.test(s)) { inserted = true; return { rows: [{ redemption_id: 'r1', deal_id: DEAL }] } }
    })
    const res = await request(app).post(`/deals/${DEAL}/redeem`).set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(201)
    expect(inserted).toBe(true)
  })
  it('forbids redeeming your own deal (400)', async () => {
    mockDb(pool, s => { if (/SELECT deal_id, business_id, business_owner_id/.test(s)) return { rows: [activeDeal(OWNER)] } })
    const res = await request(app).post(`/deals/${DEAL}/redeem`).set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(400)
  })
  it('404s for an expired deal (same NOW() guard as the public read)', async () => {
    mockDb(pool, s => { if (/SELECT deal_id, business_id, business_owner_id/.test(s)) return { rows: [{ ...activeDeal(), expires_at: past }] } })
    const res = await request(app).post(`/deals/${DEAL}/redeem`).set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(404)
  })
  it('409s on a duplicate same-day claim (unique index)', async () => {
    mockDb(pool, s => {
      if (/SELECT deal_id, business_id, business_owner_id/.test(s)) return { rows: [activeDeal()] }
      if (/INSERT INTO deal_redemptions/.test(s)) throw new Error('duplicate key value violates unique constraint "uq_redemption_per_day"')
    })
    const res = await request(app).post(`/deals/${DEAL}/redeem`).set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(409)
  })
})

describe('GET /deals/mine/clients (Client History)', () => {
  it('403s when no business is linked', async () => {
    mockDb(pool, s => { if (/FROM businesses WHERE owner_id/.test(s)) return { rows: [] } })
    const res = await request(app).get('/deals/mine/clients').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
  })
  it('aggregates the client base (200)', async () => {
    mockDb(pool, s => {
      if (/FROM businesses WHERE owner_id/.test(s)) return { rows: [{ business_id: BIZ }] }
      if (/AS total_redemptions/.test(s)) return { rows: [{ total_redemptions: 5, unique_customers: 3, total_value_cents: 22500, last_30d: 4 }] }
      if (/repeat_customers/.test(s)) return { rows: [{ repeat_customers: 1 }] }
      if (/generate_series/.test(s)) return { rows: [{ day: '2026-06-23', count: 2 }] }
      if (/FROM deal_redemptions r/.test(s)) return { rows: [{ redemption_id: 'r1', deal_title: 'Coffee', customer_name: 'Sam', amount_cents: 4500 }] }
    })
    const res = await request(app).get('/deals/mine/clients').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.unique_customers).toBe(3)
    expect(res.body.repeat_customers).toBe(1)
    expect(res.body.recent).toHaveLength(1)
  })
})
