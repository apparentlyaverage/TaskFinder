// Web Push (H1): public-key handshake + subscribe/unsubscribe. VAPID is not
// configured in the test env, so /public-key reports enabled:false — the
// subscribe/unsubscribe endpoints still persist rows regardless.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const token = authToken({ userId: ME, role: 'member' })
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc123', keys: { p256dh: 'k', auth: 'a' } }

beforeEach(() => vi.clearAllMocks())

describe('GET /push/public-key', () => {
  it('returns the public key + enabled flag (200), no auth required', async () => {
    const res = await request(app).get('/push/public-key')
    expect(res.status).toBe(200)
    expect(typeof res.body.publicKey).toBe('string')
    expect(typeof res.body.enabled).toBe('boolean')
  })
})

describe('POST /push/subscribe', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/push/subscribe').send(SUB)
    expect(res.status).toBe(401)
  })
  it('stores the subscription (201)', async () => {
    let upserted = false
    mockDb(pool, sql => { if (/INSERT INTO push_subscriptions/.test(sql)) { upserted = true; return { rows: [] } } })
    const res = await request(app).post('/push/subscribe').set('Authorization', `Bearer ${token}`).send(SUB)
    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
    expect(upserted).toBe(true)
  })
  it('422s on a missing endpoint', async () => {
    mockDb(pool)
    const res = await request(app).post('/push/subscribe').set('Authorization', `Bearer ${token}`).send({ keys: SUB.keys })
    expect(res.status).toBe(422)
  })
  it('422s when keys is not an object', async () => {
    mockDb(pool)
    const res = await request(app).post('/push/subscribe').set('Authorization', `Bearer ${token}`).send({ endpoint: SUB.endpoint, keys: 'nope' })
    expect(res.status).toBe(422)
  })
})

describe('POST /push/unsubscribe', () => {
  it('removes the subscription (200)', async () => {
    let deleted = false
    mockDb(pool, sql => { if (/DELETE FROM push_subscriptions/.test(sql)) { deleted = true; return { rowCount: 1, rows: [] } } })
    const res = await request(app).post('/push/unsubscribe').set('Authorization', `Bearer ${token}`).send({ endpoint: SUB.endpoint })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(deleted).toBe(true)
  })
  it('422s on a missing endpoint', async () => {
    mockDb(pool)
    const res = await request(app).post('/push/unsubscribe').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(422)
  })
})
