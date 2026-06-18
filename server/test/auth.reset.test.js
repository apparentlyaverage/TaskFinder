// Password reset + email verification.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))
// The email sender is a stub; assert it's invoked rather than hitting a provider.
vi.mock('../email.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ stubbed: true }) }))

const { pool } = await import('../db.js')
const { sendEmail } = await import('../email.js')
const app = (await import('../app.js')).default

beforeEach(() => vi.clearAllMocks())

describe('POST /auth/forgot-password', () => {
  it('emails a link for a real account, returns generic 200', async () => {
    mockDb(pool, sql => /FROM users WHERE email/.test(sql)
      ? { rows: [{ user_id: 'u-1', password_hash: 'hashed' }] } : undefined)
    const res = await request(app).post('/auth/forgot-password').send({ email: 'real@example.com' })
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('returns the SAME generic 200 for an unknown email (no enumeration)', async () => {
    mockDb(pool, sql => /FROM users WHERE email/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).post('/auth/forgot-password').send({ email: 'ghost@example.com' })
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('POST /auth/reset-password', () => {
  it('rejects an invalid/expired token (400)', async () => {
    mockDb(pool, sql => /FROM auth_tokens/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).post('/auth/reset-password').send({ token: 'bad', newPassword: 'NewPass123' })
    expect(res.status).toBe(400)
  })

  it('resets the password for a valid token (200)', async () => {
    mockDb(pool, sql => /SELECT token_id, user_id FROM auth_tokens/.test(sql)
      ? { rows: [{ token_id: 'tk1', user_id: 'u-1' }] } : undefined)
    pool.connect.mockResolvedValue(mockClient())
    const res = await request(app).post('/auth/reset-password').send({ token: 'goodtoken', newPassword: 'NewPass123' })
    expect(res.status).toBe(200)
  })

  it('rejects a too-short new password (422)', async () => {
    mockDb(pool)
    const res = await request(app).post('/auth/reset-password').send({ token: 'x', newPassword: 'short' })
    expect(res.status).toBe(422)
  })
})

describe('POST /auth/verify-email', () => {
  it('rejects an invalid token (400)', async () => {
    mockDb(pool, sql => /FROM auth_tokens/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).post('/auth/verify-email').send({ token: 'bad' })
    expect(res.status).toBe(400)
  })

  it('verifies the email for a valid token (200)', async () => {
    mockDb(pool, sql => /SELECT token_id, user_id FROM auth_tokens/.test(sql)
      ? { rows: [{ token_id: 'tk1', user_id: 'u-1' }] } : undefined)
    const res = await request(app).post('/auth/verify-email').send({ token: 'goodtoken' })
    expect(res.status).toBe(200)
  })
})
