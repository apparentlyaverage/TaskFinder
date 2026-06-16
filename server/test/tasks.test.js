// Core marketplace: task creation, bidding, acceptance, withdrawal, expiry.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const token = authToken({ userId: 'creator-1' })
const TASK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BID_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const future = new Date(Date.now() + 7 * 864e5).toISOString()

beforeEach(() => vi.clearAllMocks())

describe('POST /tasks', () => {
  it('creates a task (201)', async () => {
    mockDb(pool, sql => /INSERT INTO tasks/.test(sql) ? { rows: [{ task_id: TASK_ID, title: 'Fix bike' }] } : undefined)
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Fix bike', description: 'brakes', budget: 250, deadline: future })
    expect(res.status).toBe(201)
    expect(res.body.task.task_id).toBe(TASK_ID)
  })

  it('rejects a missing title (422)', async () => {
    mockDb(pool)
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${token}`)
      .send({ description: 'x', budget: 250, deadline: future })
    expect(res.status).toBe(422)
  })

  it('rejects a past deadline (400)', async () => {
    mockDb(pool)
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', description: 'y', budget: 250, deadline: '2000-01-01T00:00:00Z' })
    expect(res.status).toBe(400)
  })

  it('requires auth (401)', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x' })
    expect(res.status).toBe(401)
  })
})

describe('POST /tasks/:taskId/bids', () => {
  const openTask = { task_id: TASK_ID, creator_id: 'someone-else', status: 'open', title: 'Fix bike' }
  function setup(task, { insert } = {}) {
    mockDb(pool, sql => {
      if (/FROM tasks WHERE task_id = \$1/.test(sql)) return { rows: task ? [task] : [] }
      if (/INSERT INTO bids/.test(sql)) return insert || { rows: [{ bid_id: BID_ID }] }
      return undefined
    })
  }
  it('submits a bid (201)', async () => {
    setup(openTask)
    const res = await request(app).post(`/tasks/${TASK_ID}/bids`).set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, pitch: 'I can do this' })
    expect(res.status).toBe(201)
  })
  it('blocks bidding on your own task (403)', async () => {
    setup({ ...openTask, creator_id: 'creator-1' })
    const res = await request(app).post(`/tasks/${TASK_ID}/bids`).set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, pitch: 'mine' })
    expect(res.status).toBe(403)
  })
  it('rejects bids on a non-open task (409)', async () => {
    setup({ ...openTask, status: 'in_progress' })
    const res = await request(app).post(`/tasks/${TASK_ID}/bids`).set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, pitch: 'late' })
    expect(res.status).toBe(409)
  })
  it('404 when the task is missing', async () => {
    setup(null)
    const res = await request(app).post(`/tasks/${TASK_ID}/bids`).set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, pitch: 'ghost' })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /tasks/:taskId/bids/:bidId/accept', () => {
  it('accepts a bid, assigns the task (200)', async () => {
    mockDb(pool)
    pool.connect.mockResolvedValue(mockClient(sql => {
      if (/SELECT \* FROM tasks WHERE task_id = \$1 AND creator_id/.test(sql)) return { rows: [{ task_id: TASK_ID, status: 'open', title: 'Fix bike' }] }
      if (/SELECT \* FROM bids WHERE bid_id/.test(sql)) return { rows: [{ bid_id: BID_ID, bidder_id: 'earner-9' }] }
      return undefined
    }))
    const res = await request(app).patch(`/tasks/${TASK_ID}/bids/${BID_ID}/accept`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.assignedTo).toBe('earner-9')
  })
})

describe('PATCH /tasks/bids/:bidId/withdraw', () => {
  it('404 when the bid is not withdrawable', async () => {
    mockDb(pool, sql => /UPDATE bids SET status = 'withdrawn'/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).patch(`/tasks/bids/${BID_ID}/withdraw`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /tasks/admin/expire', () => {
  it('forbids non-admins (403)', async () => {
    mockDb(pool)
    const res = await request(app).post('/tasks/admin/expire').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
  it('runs for admins (200)', async () => {
    mockDb(pool, sql => /status = 'expired'/.test(sql) ? { rows: [{ task_id: TASK_ID }] } : undefined)
    const adminToken = authToken({ userId: 'admin-1', role: 'admin' })
    const res = await request(app).post('/tasks/admin/expire').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.expired).toBe(1)
  })
})
