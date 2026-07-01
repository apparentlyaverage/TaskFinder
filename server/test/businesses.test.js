// Business-owner self-service: my page (read/edit), analytics, public events,
// and admin owner assignment. Authorisation is by OWNERSHIP, not role alone.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BIZ   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ownerToken = authToken({ userId: OWNER, role: 'business' })
const adminToken = authToken({ userId: 'admin-1', role: 'admin' })
const memberToken = authToken({ userId: 'mem-1', role: 'member' })

const myBiz = { business_id: BIZ, name: 'Joe Coffee', category: 'food', status: 'active', owner_id: OWNER }

beforeEach(() => vi.clearAllMocks())

describe('GET /businesses/mine', () => {
  it('returns the caller\'s business (200)', async () => {
    mockDb(pool, sql => { if (/FROM businesses WHERE owner_id/.test(sql)) return { rows: [myBiz] } })
    const res = await request(app).get('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.business.business_id).toBe(BIZ)
  })
  it('404s when no business is linked', async () => {
    mockDb(pool, sql => { if (/FROM businesses WHERE owner_id/.test(sql)) return { rows: [] } })
    const res = await request(app).get('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(404)
  })
  it('401s without a token', async () => {
    const res = await request(app).get('/businesses/mine')
    expect(res.status).toBe(401)
  })
  it('is matched before GET /:id (mine is not treated as a UUID)', async () => {
    mockDb(pool, sql => { if (/FROM businesses WHERE owner_id/.test(sql)) return { rows: [] } })
    const res = await request(app).get('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(404) // the /mine handler ran (not a 422 UUID failure from /:id)
  })
})

describe('PATCH /businesses/mine', () => {
  function setup({ owned = [{ business_id: BIZ }] } = {}) {
    mockDb(pool, sql => {
      if (/SELECT business_id FROM businesses WHERE owner_id/.test(sql)) return { rows: owned }
      if (/^UPDATE businesses SET/.test(sql.trim())) return { rows: [{ ...myBiz, tagline: 'Best brew in town' }] }
      return undefined
    })
  }
  it('updates whitelisted fields (200)', async () => {
    setup()
    const res = await request(app).patch('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
      .send({ tagline: 'Best brew in town', themeColor: '#1E90FF' })
    expect(res.status).toBe(200)
  })
  it('never writes admin-only fields (status/fee ignored)', async () => {
    let updateSql = ''
    mockDb(pool, sql => {
      if (/SELECT business_id FROM businesses WHERE owner_id/.test(sql)) return { rows: [{ business_id: BIZ }] }
      if (/^UPDATE businesses SET/.test(sql.trim())) { updateSql = sql; return { rows: [myBiz] } }
      return undefined
    })
    const res = await request(app).patch('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Renamed', status: 'active', feePaid: 0, fee_paid: 0, owner_id: 'x' })
    expect(res.status).toBe(200)
    // The generated UPDATE must touch name but NOT status / fee_paid / owner_id.
    expect(updateSql).toMatch(/name = \$/)
    expect(updateSql).not.toMatch(/status =/)
    expect(updateSql).not.toMatch(/fee_paid =/)
    expect(updateSql).not.toMatch(/owner_id =/)
  })
  it('rejects an invalid theme colour (422)', async () => {
    setup()
    const res = await request(app).patch('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
      .send({ themeColor: 'notacolour' })
    expect(res.status).toBe(422)
  })
  it('404s when no business is linked', async () => {
    setup({ owned: [] })
    const res = await request(app).patch('/businesses/mine').set('Authorization', `Bearer ${ownerToken}`)
      .send({ tagline: 'hi' })
    expect(res.status).toBe(404)
  })
})

describe('GET /businesses/mine/analytics', () => {
  it('returns totals + a zero-filled view series (200)', async () => {
    mockDb(pool, sql => {
      if (/SELECT business_id FROM businesses WHERE owner_id/.test(sql)) return { rows: [{ business_id: BIZ }] }
      if (/GROUP BY event_type/.test(sql)) return { rows: [{ event_type: 'view', cnt: 12 }, { event_type: 'whatsapp_click', cnt: 3 }] }
      if (/generate_series/.test(sql)) return { rows: [{ day: '2026-06-18', count: 5 }, { day: '2026-06-19', count: 7 }] }
      return undefined
    })
    const res = await request(app).get('/businesses/mine/analytics?days=30').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.total_views).toBe(12)
    expect(res.body.total_clicks).toBe(3)
    expect(res.body.views_series).toHaveLength(2)
    expect(res.body.engagement_rate).toBeCloseTo(25.0)
  })
  it('404s when no business is linked', async () => {
    mockDb(pool, sql => { if (/SELECT business_id FROM businesses WHERE owner_id/.test(sql)) return { rows: [] } })
    const res = await request(app).get('/businesses/mine/analytics').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /businesses/:id/events (public)', () => {
  it('records a view for an active business (204)', async () => {
    let inserted = false
    mockDb(pool, sql => {
      if (/SELECT status FROM businesses/.test(sql)) return { rows: [{ status: 'active' }] }
      if (/INSERT INTO business_page_events/.test(sql)) { inserted = true; return { rows: [] } }
      return undefined
    })
    const res = await request(app).post(`/businesses/${BIZ}/events`).send({ type: 'view' })
    expect(res.status).toBe(204)
    expect(inserted).toBe(true)
  })
  it('no-ops (204) for an inactive/unknown business without inserting', async () => {
    let inserted = false
    mockDb(pool, sql => {
      if (/SELECT status FROM businesses/.test(sql)) return { rows: [{ status: 'pending' }] }
      if (/INSERT INTO business_page_events/.test(sql)) { inserted = true; return { rows: [] } }
      return undefined
    })
    const res = await request(app).post(`/businesses/${BIZ}/events`).send({ type: 'view' })
    expect(res.status).toBe(204)
    expect(inserted).toBe(false)
  })
  it('rejects an unknown event type (422)', async () => {
    mockDb(pool)
    const res = await request(app).post(`/businesses/${BIZ}/events`).send({ type: 'hack' })
    expect(res.status).toBe(422)
  })
})

describe('PATCH /businesses/:id/owner (admin)', () => {
  it('assigns an owner and promotes them to business role (200)', async () => {
    let promoted = false
    mockDb(pool) // requireAuth
    pool.connect.mockResolvedValue(mockClient(sql => {
      if (/SELECT user_id, role FROM users/.test(sql)) return { rows: [{ user_id: OWNER, role: 'member' }] }
      if (/UPDATE users SET role = 'business'/.test(sql)) { promoted = true; return { rows: [] } }
      if (/UPDATE businesses SET owner_id/.test(sql)) return { rows: [{ ...myBiz, owner_id: OWNER }] }
      return undefined
    }))
    const res = await request(app).patch(`/businesses/${BIZ}/owner`).set('Authorization', `Bearer ${adminToken}`)
      .send({ ownerEmail: 'owner@example.com' })
    expect(res.status).toBe(200)
    expect(promoted).toBe(true)
  })
  it('forbids non-admins (403)', async () => {
    mockDb(pool)
    const res = await request(app).patch(`/businesses/${BIZ}/owner`).set('Authorization', `Bearer ${memberToken}`)
      .send({ ownerEmail: 'owner@example.com' })
    expect(res.status).toBe(403)
  })
  it('404s for an unknown owner email', async () => {
    mockDb(pool)
    pool.connect.mockResolvedValue(mockClient(sql => {
      if (/SELECT user_id, role FROM users/.test(sql)) return { rows: [] }
      return undefined
    }))
    const res = await request(app).patch(`/businesses/${BIZ}/owner`).set('Authorization', `Bearer ${adminToken}`)
      .send({ ownerEmail: 'nobody@example.com' })
    expect(res.status).toBe(404)
  })
})

describe('business reviews (E1)', () => {
  const REV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  it('lets a member review a business (201)', async () => {
    mockDb(pool, sql => {
      if (/SELECT owner_id, status, disabled_features FROM businesses/.test(sql)) return { rows: [{ owner_id: OWNER, status: 'active', disabled_features: [] }] }
      if (/INSERT INTO business_reviews/.test(sql)) return { rows: [{ review_id: REV, rating: 5 }] }
      return { rows: [] }
    })
    const res = await request(app).post(`/businesses/${BIZ}/reviews`).set('Authorization', `Bearer ${memberToken}`).send({ rating: 5, comment: 'Great coffee' })
    expect(res.status).toBe(201)
  })
  it('blocks reviewing your own business (400)', async () => {
    mockDb(pool, sql => /SELECT owner_id, status, disabled_features FROM businesses/.test(sql) ? { rows: [{ owner_id: OWNER, status: 'active', disabled_features: [] }] } : undefined)
    const res = await request(app).post(`/businesses/${BIZ}/reviews`).set('Authorization', `Bearer ${ownerToken}`).send({ rating: 5 })
    expect(res.status).toBe(400)
  })
  it('403 when reviews are disabled for the business', async () => {
    mockDb(pool, sql => /SELECT owner_id, status, disabled_features FROM businesses/.test(sql) ? { rows: [{ owner_id: OWNER, status: 'active', disabled_features: ['reviews'] }] } : undefined)
    const res = await request(app).post(`/businesses/${BIZ}/reviews`).set('Authorization', `Bearer ${memberToken}`).send({ rating: 5 })
    expect(res.status).toBe(403)
  })
  it('returns reviews + aggregate (200)', async () => {
    mockDb(pool, sql => {
      if (/AVG\(rating\)/.test(sql)) return { rows: [{ avg_rating: '4.5', rating_count: 2 }] }
      if (/FROM business_reviews r/.test(sql)) return { rows: [{ review_id: REV, rating: 5, comment: 'nice' }] }
    })
    const res = await request(app).get(`/businesses/${BIZ}/reviews`)
    expect(res.status).toBe(200)
    expect(res.body.reviews).toHaveLength(1)
  })
})

describe('business boost (E4)', () => {
  it('boosts the owner\'s business (200)', async () => {
    mockDb(pool, sql => {
      if (/SELECT business_id, disabled_features FROM businesses WHERE owner_id/.test(sql)) return { rows: [{ business_id: BIZ, disabled_features: [] }] }
      if (/UPDATE businesses SET boosted_until/.test(sql)) return { rows: [{ boosted_until: new Date().toISOString() }] }
    })
    const res = await request(app).post('/businesses/mine/boost').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
  })
  it('403 when the caller owns no business', async () => {
    mockDb(pool, sql => /SELECT business_id, disabled_features FROM businesses WHERE owner_id/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).post('/businesses/mine/boost').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
  })
})

describe('business public_code + feature toggles (E3/E5)', () => {
  it('resolves a business by public_code (200)', async () => {
    mockDb(pool, sql => /WHERE upper\(public_code\)/.test(sql) ? { rows: [{ business_id: BIZ, name: 'Joe Coffee', status: 'active' }] } : undefined)
    const res = await request(app).get('/businesses/code/ABCD1234')
    expect(res.status).toBe(200)
    expect(res.body.business_id).toBe(BIZ)
  })
  it('404 for an unknown code', async () => {
    mockDb(pool, sql => /WHERE upper\(public_code\)/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).get('/businesses/code/ZZZZ9999')
    expect(res.status).toBe(404)
  })
  it('lets an admin toggle feature switches (200)', async () => {
    mockDb(pool, sql => /UPDATE businesses SET disabled_features/.test(sql) ? { rows: [{ business_id: BIZ, disabled_features: ['deals'] }] } : undefined)
    const res = await request(app).patch(`/businesses/${BIZ}/features`).set('Authorization', `Bearer ${adminToken}`).send({ disabledFeatures: ['deals'] })
    expect(res.status).toBe(200)
  })
  it('forbids a non-admin from toggling features (403)', async () => {
    mockDb(pool)
    const res = await request(app).patch(`/businesses/${BIZ}/features`).set('Authorization', `Bearer ${memberToken}`).send({ disabledFeatures: ['deals'] })
    expect(res.status).toBe(403)
  })
})
