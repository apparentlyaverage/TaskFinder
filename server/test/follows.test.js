// Social graph: follow/unfollow users + businesses, self-follow guard,
// target-existence, follow state/counts, and the following feed.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const BIZ   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const meToken = authToken({ userId: ME, role: 'member' })

beforeEach(() => vi.clearAllMocks())

describe('POST /follows', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/follows').send({ targetType: 'user', targetId: OTHER })
    expect(res.status).toBe(401)
  })
  it('follows another user (201) and inserts an edge', async () => {
    let inserted = false
    mockDb(pool, sql => {
      if (/FROM users WHERE user_id/.test(sql)) return { rows: [{ user_id: OTHER }] }
      if (/INSERT INTO follows/.test(sql)) { inserted = true; return { rowCount: 1, rows: [] } }
    })
    const res = await request(app).post('/follows').set('Authorization', `Bearer ${meToken}`).send({ targetType: 'user', targetId: OTHER })
    expect(res.status).toBe(201)
    expect(res.body.following).toBe(true)
    expect(inserted).toBe(true)
  })
  it('follows a business (201)', async () => {
    mockDb(pool, sql => {
      if (/SELECT owner_id FROM businesses/.test(sql)) return { rows: [{ owner_id: OTHER }] }
      if (/INSERT INTO follows/.test(sql)) return { rowCount: 1, rows: [] }
    })
    const res = await request(app).post('/follows').set('Authorization', `Bearer ${meToken}`).send({ targetType: 'business', targetId: BIZ })
    expect(res.status).toBe(201)
  })
  it('refuses to follow yourself (400)', async () => {
    mockDb(pool)
    const res = await request(app).post('/follows').set('Authorization', `Bearer ${meToken}`).send({ targetType: 'user', targetId: ME })
    expect(res.status).toBe(400)
  })
  it('404s when the target does not exist', async () => {
    mockDb(pool, sql => { if (/FROM users WHERE user_id/.test(sql)) return { rows: [] } })
    const res = await request(app).post('/follows').set('Authorization', `Bearer ${meToken}`).send({ targetType: 'user', targetId: OTHER })
    expect(res.status).toBe(404)
  })
  it('422s on a bad targetType', async () => {
    mockDb(pool)
    const res = await request(app).post('/follows').set('Authorization', `Bearer ${meToken}`).send({ targetType: 'task', targetId: OTHER })
    expect(res.status).toBe(422)
  })
})

describe('DELETE /follows/:type/:id', () => {
  it('unfollows (200)', async () => {
    mockDb(pool, sql => { if (/DELETE FROM follows/.test(sql)) return { rowCount: 1, rows: [] } })
    const res = await request(app).delete(`/follows/business/${BIZ}`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(200)
    expect(res.body.following).toBe(false)
  })
})

describe('GET /follows/state/:type/:id', () => {
  it('returns following + follower count (200)', async () => {
    mockDb(pool, sql => { if (/AS following/.test(sql)) return { rows: [{ following: true, followers: 7 }] } })
    const res = await request(app).get(`/follows/state/user/${OTHER}`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(200)
    expect(res.body.following).toBe(true)
    expect(res.body.followers).toBe(7)
  })
})

describe('GET /follows/me', () => {
  it('returns followed users + businesses (200)', async () => {
    mockDb(pool, sql => {
      if (/target_type = 'user'/.test(sql)) return { rows: [{ user_id: OTHER, display_name: 'Sam' }] }
      if (/target_type = 'business'/.test(sql)) return { rows: [{ business_id: BIZ, name: 'Joe Coffee' }] }
    })
    const res = await request(app).get('/follows/me').set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(200)
    expect(res.body.users).toHaveLength(1)
    expect(res.body.businesses).toHaveLength(1)
  })
})
