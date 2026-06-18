// Public beta endpoints: feedback + launch waitlist.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../db.js', () => ({ pool: { query: vi.fn().mockResolvedValue({ rows: [] }), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

beforeEach(() => { vi.clearAllMocks(); pool.query.mockResolvedValue({ rows: [] }) })

describe('POST /feedback', () => {
  it('accepts feedback (201)', async () => {
    const res = await request(app).post('/feedback').send({ message: 'Love the beta!', name: 'Sam' })
    expect(res.status).toBe(201)
    expect(pool.query).toHaveBeenCalled()
  })
  it('rejects empty feedback (422)', async () => {
    const res = await request(app).post('/feedback').send({ message: '' })
    expect(res.status).toBe(422)
  })
})

describe('POST /waitlist', () => {
  it('joins the waitlist (201)', async () => {
    const res = await request(app).post('/waitlist').send({ email: 'me@example.com' })
    expect(res.status).toBe(201)
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO waitlist/)
  })
  it('rejects a bad email (422)', async () => {
    const res = await request(app).post('/waitlist').send({ email: 'not-an-email' })
    expect(res.status).toBe(422)
  })
})
