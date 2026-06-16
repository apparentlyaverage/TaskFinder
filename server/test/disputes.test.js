// Disputes lifecycle: raise, list, view (authz), admin resolve.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TASK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const DISPUTE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const token = authToken({ userId: ME })
const adminToken = authToken({ userId: 'admin-1', role: 'admin' })

beforeEach(() => vi.clearAllMocks())

describe('POST /disputes', () => {
  // task where the caller is the creator and work is in progress
  const okTask = { task_id: TASK_ID, creator_id: ME, assigned_to: 'earner-2', status: 'in_progress', title: 'Fix bike' }
  function setup(task, { insertThrows } = {}) {
    mockDb(pool) // requireAuth
    pool.connect.mockResolvedValue(mockClient(sql => {
      if (/FROM tasks WHERE task_id = \$1 FOR UPDATE/.test(sql)) return { rows: task ? [task] : [] }
      if (/INSERT INTO disputes/.test(sql)) { if (insertThrows) throw insertThrows; return { rows: [{ dispute_id: DISPUTE_ID }] } }
      return undefined
    }))
  }
  it('opens a dispute for a participant (201)', async () => {
    setup(okTask)
    const res = await request(app).post('/disputes').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, reason: 'Work was not completed as agreed.' })
    expect(res.status).toBe(201)
    expect(res.body.dispute.dispute_id).toBe(DISPUTE_ID)
  })
  it('forbids a non-participant (403)', async () => {
    setup({ ...okTask, creator_id: 'x', assigned_to: 'y' })
    const res = await request(app).post('/disputes').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, reason: 'not mine' })
    expect(res.status).toBe(403)
  })
  it('rejects disputing an open task (409)', async () => {
    setup({ ...okTask, status: 'open' })
    const res = await request(app).post('/disputes').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, reason: 'too early' })
    expect(res.status).toBe(409)
  })
  it('maps a duplicate dispute to 409', async () => {
    setup(okTask, { insertThrows: { code: '23505' } })
    const res = await request(app).post('/disputes').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, reason: 'again' })
    expect(res.status).toBe(409)
  })
})

describe('GET /disputes/:id (authz)', () => {
  it('lets a participant view it (200)', async () => {
    mockDb(pool, sql => {
      if (/FROM disputes d JOIN tasks/.test(sql)) return { rows: [{ dispute_id: DISPUTE_ID, task_id: TASK_ID, creator_id: ME, assigned_to: 'earner-2' }] }
      if (/FROM dispute_events/.test(sql)) return { rows: [] }
      return undefined
    })
    const res = await request(app).get(`/disputes/${DISPUTE_ID}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
  it('blocks a non-participant non-admin (403)', async () => {
    mockDb(pool, sql => /FROM disputes d JOIN tasks/.test(sql)
      ? { rows: [{ dispute_id: DISPUTE_ID, creator_id: 'x', assigned_to: 'y' }] } : undefined)
    const res = await request(app).get(`/disputes/${DISPUTE_ID}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /disputes/:id', () => {
  it('forbids non-admins (403)', async () => {
    mockDb(pool)
    const res = await request(app).patch(`/disputes/${DISPUTE_ID}`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'under_review' })
    expect(res.status).toBe(403)
  })
  it('lets an admin resolve it (200)', async () => {
    mockDb(pool)
    pool.connect.mockResolvedValue(mockClient(sql => {
      if (/FROM disputes d JOIN tasks/.test(sql)) return { rows: [{ dispute_id: DISPUTE_ID, task_id: TASK_ID, creator_id: ME, assigned_to: 'earner-2', title: 'Fix bike' }] }
      if (/UPDATE disputes SET/.test(sql)) return { rows: [{ dispute_id: DISPUTE_ID, status: 'resolved_creator' }] }
      return undefined
    }))
    const res = await request(app).patch(`/disputes/${DISPUTE_ID}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved_creator', resolution: 'refund', admin_notes: 'Creator was right.' })
    expect(res.status).toBe(200)
    expect(res.body.dispute.status).toBe('resolved_creator')
  })
})
