// Admin monitoring endpoints (§7.8) — admin-only.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const adminToken = authToken({ userId: ADMIN_ID, role: 'admin' })
const memberToken = authToken({ userId: 'm-1', role: 'member' })

beforeEach(() => vi.clearAllMocks())

describe('admin authz', () => {
  it('rejects an unauthenticated request (401)', async () => {
    const res = await request(app).get('/admin/stats')
    expect(res.status).toBe(401)
  })
  it('rejects a non-admin (403)', async () => {
    mockDb(pool)
    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /admin/stats', () => {
  it('returns a platform overview for an admin (200)', async () => {
    mockDb(pool, sql => {
      if (/FROM users/.test(sql)) return { rows: [{ total: 10, new_7d: 3, deleted: 0 }] }
      if (/FROM tasks GROUP BY status/.test(sql)) return { rows: [{ status: 'open', count: 4 }, { status: 'completed', count: 6 }] }
      if (/FROM bids/.test(sql)) return { rows: [{ total: 20 }] }
      if (/FROM disputes GROUP BY status/.test(sql)) return { rows: [{ status: 'open', count: 1 }] }
      if (/FROM businesses/.test(sql)) return { rows: [{ total: 5, active: 4 }] }
      return undefined
    })
    const res = await request(app).get('/admin/stats').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.tasks.total).toBe(10)
    expect(res.body.completion_rate).toBe(60) // 6 of 10
    expect(res.body.users.total).toBe(10)
  })
})

describe('GET /admin/activity', () => {
  it('returns the activity feed (200)', async () => {
    mockDb(pool, sql => /FROM activity_logs/.test(sql) ? { rows: [{ activity_id: 'a1', action: 'user.login' }] } : undefined)
    const res = await request(app).get('/admin/activity').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.activity).toHaveLength(1)
  })
})

describe('GET /admin/users', () => {
  it('returns a user list (200)', async () => {
    mockDb(pool, sql => /FROM users u LEFT JOIN user_profiles/.test(sql) ? { rows: [{ user_id: 'u1', email: 'a@x.com', role: 'member' }] } : undefined)
    const res = await request(app).get('/admin/users?q=a').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.users[0].email).toBe('a@x.com')
  })
})

describe('GET /admin/analytics', () => {
  it('returns a daily time-series (200)', async () => {
    mockDb(pool, sql => /generate_series/.test(sql) ? { rows: [{ day: '2026-06-01', signups: 2, tasks_created: 5, tasks_completed: 1 }] } : undefined)
    const res = await request(app).get('/admin/analytics?days=7').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.series[0].signups).toBe(2)
  })
})

describe('admin locations', () => {
  it('creates a campus (201)', async () => {
    mockDb(pool, sql => /INSERT INTO locations/.test(sql) ? { rows: [{ location_id: 'l1', name: 'UCT', kind: 'campus' }] } : undefined)
    const res = await request(app).post('/admin/locations').set('Authorization', `Bearer ${adminToken}`).send({ name: 'UCT', kind: 'campus' })
    expect(res.status).toBe(201)
    expect(res.body.location.name).toBe('UCT')
  })
  it('rejects a non-admin (403)', async () => {
    mockDb(pool)
    const res = await request(app).post('/admin/locations').set('Authorization', `Bearer ${memberToken}`).send({ name: 'x', kind: 'campus' })
    expect(res.status).toBe(403)
  })
})

describe('feature flags', () => {
  it('lists flags for an admin (200)', async () => {
    mockDb(pool, sql => /FROM feature_flags/.test(sql) ? { rows: [{ flag_key: 'recurring_tasks', enabled: true }] } : undefined)
    const res = await request(app).get('/admin/flags').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.flags[0].flag_key).toBe('recurring_tasks')
  })
  it('toggles a flag (200)', async () => {
    mockDb(pool, sql => /UPDATE feature_flags/.test(sql) ? { rows: [{ flag_key: 'recurring_tasks', enabled: false }] } : undefined)
    const res = await request(app).patch('/admin/flags/recurring_tasks').set('Authorization', `Bearer ${adminToken}`).send({ enabled: false })
    expect(res.status).toBe(200)
    expect(res.body.flag.enabled).toBe(false)
  })
  it('exposes enabled flags publicly at GET /flags', async () => {
    mockDb(pool, sql => /SELECT flag_key, enabled FROM feature_flags/.test(sql) ? { rows: [{ flag_key: 'recurring_tasks', enabled: true }] } : undefined)
    const res = await request(app).get('/flags')
    expect(res.status).toBe(200)
    expect(res.body.flags.recurring_tasks).toBe(true)
  })
})

describe('PATCH /admin/users/:id (moderation)', () => {
  const TARGET = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  it('requires admin (403 for member)', async () => {
    mockDb(pool)
    const res = await request(app).patch(`/admin/users/${TARGET}`).set('Authorization', `Bearer ${memberToken}`).send({ suspended: true })
    expect(res.status).toBe(403)
  })
  it('suspends a user (200)', async () => {
    mockDb(pool, sql => /UPDATE users SET/.test(sql) ? { rows: [{ user_id: TARGET, email: 'b@x.com', role: 'member', suspended_at: new Date() }] } : undefined)
    const res = await request(app).patch(`/admin/users/${TARGET}`).set('Authorization', `Bearer ${adminToken}`).send({ suspended: true })
    expect(res.status).toBe(200)
    expect(res.body.user.suspended_at).toBeTruthy()
  })
  it('refuses to moderate your own account (400)', async () => {
    mockDb(pool)
    const res = await request(app).patch(`/admin/users/${ADMIN_ID}`).set('Authorization', `Bearer ${adminToken}`).send({ suspended: true })
    expect(res.status).toBe(400)
  })
  it('400 when nothing to update', async () => {
    mockDb(pool)
    const res = await request(app).patch(`/admin/users/${TARGET}`).set('Authorization', `Bearer ${adminToken}`).send({})
    expect(res.status).toBe(400)
  })
})
