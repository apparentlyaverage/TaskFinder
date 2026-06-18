// Paystack payment routes: escrow initiate, webhook (HMAC-SHA512), release.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createHmac } from 'node:crypto'
import { authToken, mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

// The route reads PAYSTACK_SECRET_KEY at call time, so set it before importing app.
process.env.PAYSTACK_SECRET_KEY = 'sk_test_dummy_key'

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME       = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TASK_ID  = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ESCROW_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const token      = authToken({ userId: ME })
const adminToken = authToken({ userId: 'admin-1', role: 'admin' })

// Stub global fetch so no real Paystack HTTP call is made.
function stubFetch(json) {
  global.fetch = vi.fn(async () => ({ json: async () => json }))
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => { delete global.fetch })

describe('POST /payments/initiate', () => {
  const okTask = { task_id: TASK_ID, title: 'Fix bike', budget: 150, assigned_to: 'earner-2', status: 'in_progress' }

  function setup(task, { existingEscrow = [] } = {}) {
    mockDb(pool) // requireAuth token_version lookup
    pool.connect.mockResolvedValue(mockClient(sql => {
      if (/FROM tasks t\b/.test(sql)) return { rows: task ? [task] : [] }
      if (/SELECT et\.escrow_id, et\.status, et\.paystack_ref/.test(sql)) return { rows: existingEscrow }
      if (/INSERT INTO escrow_transactions/.test(sql)) return { rows: [{ escrow_id: ESCROW_ID }] }
      return undefined
    }))
  }

  it('creates escrow and returns a checkout URL (201)', async () => {
    setup(okTask)
    stubFetch({ status: true, data: { authorization_url: 'https://checkout.paystack.com/xyz' } })
    const res = await request(app).post('/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, email: 'creator@example.com' })
    expect(res.status).toBe(201)
    expect(res.body.escrow_id).toBe(ESCROW_ID)
    expect(res.body.authorization_url).toMatch(/checkout\.paystack\.com/)
    // Amount sent to Paystack must be in kobo (R150 → 15000)
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.amount).toBe(15000)
    expect(body.currency).toBe('ZAR')
  })

  it('404s when the task is not the caller\'s', async () => {
    setup(null)
    const res = await request(app).post('/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, email: 'creator@example.com' })
    expect(res.status).toBe(404)
  })

  it('400s when the task has no assigned earner', async () => {
    setup({ ...okTask, assigned_to: null })
    const res = await request(app).post('/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, email: 'creator@example.com' })
    expect(res.status).toBe(400)
  })

  it('409s when escrow already exists in a non-pending state', async () => {
    setup(okTask, { existingEscrow: [{ escrow_id: ESCROW_ID, status: 'funded', paystack_ref: 'rlvr-x' }] })
    const res = await request(app).post('/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, email: 'creator@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.status).toBe('funded')
  })

  it('422s on invalid input', async () => {
    setup(okTask)
    const res = await request(app).post('/payments/initiate')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: 'not-a-uuid', email: 'bad' })
    expect(res.status).toBe(422)
  })
})

describe('POST /payments/webhook', () => {
  function sign(payload) {
    return createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(payload).digest('hex')
  }

  it('rejects a missing signature (400)', async () => {
    const res = await request(app).post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'charge.success', data: {} }))
    expect(res.status).toBe(400)
  })

  it('rejects an invalid signature (401)', async () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'rlvr-x' } })
    const res = await request(app).post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'deadbeef')
      .send(payload)
    expect(res.status).toBe(401)
  })

  it('accepts a correctly signed event (200)', async () => {
    mockDb(pool) // async handler looks up escrow by ref → [] → returns early
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'rlvr-x', amount: 15000 } })
    const res = await request(app).post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', sign(payload))
      .send(payload)
    expect(res.status).toBe(200)
  })
})

describe('POST /payments/release/:escrowId', () => {
  it('forbids non-admins (403)', async () => {
    mockDb(pool)
    const res = await request(app).post(`/payments/release/${ESCROW_ID}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('releases a funded escrow to the earner (200)', async () => {
    mockDb(pool, sql => {
      if (/FROM escrow_transactions et/.test(sql)) return { rows: [{
        escrow_id: ESCROW_ID, status: 'funded', amount_cents: 15000,
        earner_id: 'earner-2', paystack_recipient_code: 'RCP_test',
      }] }
      return undefined
    })
    stubFetch({ status: true, data: { transfer_code: 'TRF_test' } })
    const res = await request(app).post(`/payments/release/${ESCROW_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.transfer_code).toBe('TRF_test')
    expect(res.body.status).toBe('released')
    // Transfer amount must equal the stored kobo amount
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.amount).toBe(15000)
  })

  it('400s when escrow is not funded', async () => {
    mockDb(pool, sql => {
      if (/FROM escrow_transactions et/.test(sql)) return { rows: [{
        escrow_id: ESCROW_ID, status: 'pending', amount_cents: 15000,
        earner_id: 'earner-2', paystack_recipient_code: 'RCP_test',
      }] }
      return undefined
    })
    const res = await request(app).post(`/payments/release/${ESCROW_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })
})
