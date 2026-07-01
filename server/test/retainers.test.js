// Retainers (F1b): recurring engagements with a provider — create (+ first task),
// list, and cancel with authorization.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROVIDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const RET = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const token = authToken({ userId: ME, role: 'member' })

beforeEach(() => vi.clearAllMocks())

describe('POST /retainers', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/retainers').send({ providerId: PROVIDER, title: 'x', amount: 150, cadence: 'weekly' })
    expect(res.status).toBe(401)
  })
  it('sets up a retainer and spawns the first task (201)', async () => {
    let taskSpawned = false
    mockDb(pool, s => {
      if (/FROM users WHERE user_id/.test(s)) return { rows: [{ user_id: PROVIDER }] }
      if (/INSERT INTO retainers/.test(s)) return { rows: [{ retainer_id: RET, client_id: ME, provider_id: PROVIDER, title: 'Weekly tutoring', description: null, amount: 150 }] }
      if (/INSERT INTO tasks/.test(s)) { taskSpawned = true; return { rows: [{ task_id: 't1' }] } }
      return { rows: [] }
    })
    const res = await request(app).post('/retainers').set('Authorization', `Bearer ${token}`).send({ providerId: PROVIDER, title: 'Weekly tutoring', amount: 150, cadence: 'weekly' })
    expect(res.status).toBe(201)
    expect(taskSpawned).toBe(true)
  })
  it('rejects a retainer with yourself (400)', async () => {
    mockDb(pool)
    const res = await request(app).post('/retainers').set('Authorization', `Bearer ${token}`).send({ providerId: ME, title: 'x', amount: 150, cadence: 'weekly' })
    expect(res.status).toBe(400)
  })
  it('404 when the provider does not exist', async () => {
    mockDb(pool, s => /FROM users WHERE user_id/.test(s) ? { rows: [] } : undefined)
    const res = await request(app).post('/retainers').set('Authorization', `Bearer ${token}`).send({ providerId: PROVIDER, title: 'x', amount: 150, cadence: 'weekly' })
    expect(res.status).toBe(404)
  })
  it('422 on an unsupported cadence', async () => {
    mockDb(pool)
    const res = await request(app).post('/retainers').set('Authorization', `Bearer ${token}`).send({ providerId: PROVIDER, title: 'x', amount: 150, cadence: 'yearly' })
    expect(res.status).toBe(422)
  })
})

describe('GET /retainers/mine', () => {
  it('lists my retainers (200)', async () => {
    mockDb(pool, s => /FROM retainers r/.test(s) ? { rows: [{ retainer_id: RET, title: 'Weekly tutoring', active: true }] } : undefined)
    const res = await request(app).get('/retainers/mine').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.retainers).toHaveLength(1)
  })
})

describe('POST /retainers/:id/cancel', () => {
  it('lets a party cancel (200)', async () => {
    mockDb(pool, s => /SELECT client_id, provider_id FROM retainers/.test(s) ? { rows: [{ client_id: ME, provider_id: PROVIDER }] } : { rows: [] })
    const res = await request(app).post(`/retainers/${RET}/cancel`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
  it('403 when not a party to the retainer', async () => {
    mockDb(pool, s => /SELECT client_id, provider_id FROM retainers/.test(s) ? { rows: [{ client_id: PROVIDER, provider_id: RET }] } : undefined)
    const res = await request(app).post(`/retainers/${RET}/cancel`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
