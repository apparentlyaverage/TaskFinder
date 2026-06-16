// §7.2 account security: login lockout, logout-all, account deletion, export.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { authToken, mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const token = authToken({ userId: 'u-1' })

beforeEach(() => vi.clearAllMocks())

describe('POST /auth/login — lockout', () => {
  it('locks the account at the 5th failed attempt (423)', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 12)
    mockDb(pool, sql => /FROM users u LEFT JOIN user_profiles/.test(sql)
      ? { rows: [{ user_id: 'u-1', email: 'a@x.com', role: 'member', password_hash: hash, token_version: 0, failed_login_attempts: 4, locked_until: null, deleted_at: null }] }
      : undefined)
    const res = await request(app).post('/auth/login').send({ email: 'a@x.com', password: 'wrong-password' })
    expect(res.status).toBe(423)
    expect(res.body.message).toMatch(/locked/i)
  })

  it('refuses login while locked, before checking the password (423)', async () => {
    mockDb(pool, sql => /FROM users u LEFT JOIN user_profiles/.test(sql)
      ? { rows: [{ user_id: 'u-1', email: 'a@x.com', role: 'member', password_hash: 'x', token_version: 0, locked_until: new Date(Date.now() + 6e5), deleted_at: null }] }
      : undefined)
    const res = await request(app).post('/auth/login').send({ email: 'a@x.com', password: 'whatever' })
    expect(res.status).toBe(423)
  })

  it('treats a deleted account as invalid credentials (401)', async () => {
    mockDb(pool, sql => /FROM users u LEFT JOIN user_profiles/.test(sql)
      ? { rows: [{ user_id: 'u-1', email: 'a@x.com', role: 'member', password_hash: 'x', token_version: 0, deleted_at: new Date() }] }
      : undefined)
    const res = await request(app).post('/auth/login').send({ email: 'a@x.com', password: 'whatever' })
    expect(res.status).toBe(401)
  })
})

describe('POST /auth/logout-all', () => {
  it('requires auth (401)', async () => {
    const res = await request(app).post('/auth/logout-all')
    expect(res.status).toBe(401)
  })
  it('bumps token_version and returns 200', async () => {
    mockDb(pool)
    const res = await request(app).post('/auth/logout-all').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/all devices/i)
  })
})

describe('DELETE /profile/account', () => {
  it('requires auth (401)', async () => {
    const res = await request(app).delete('/profile/account')
    expect(res.status).toBe(401)
  })
  it('rejects a wrong password for a local account (401)', async () => {
    const hash = await bcrypt.hash('RealPass123', 12)
    mockDb(pool)
    pool.connect.mockResolvedValue(mockClient(sql => /SELECT password_hash FROM users/.test(sql) ? { rows: [{ password_hash: hash }] } : undefined))
    const res = await request(app).delete('/profile/account').set('Authorization', `Bearer ${token}`).send({ password: 'WRONG' })
    expect(res.status).toBe(401)
  })
  it('deletes (anonymises) with the correct password (200)', async () => {
    const hash = await bcrypt.hash('RealPass123', 12)
    mockDb(pool)
    pool.connect.mockResolvedValue(mockClient(sql => /SELECT password_hash FROM users/.test(sql) ? { rows: [{ password_hash: hash }] } : undefined))
    const res = await request(app).delete('/profile/account').set('Authorization', `Bearer ${token}`).send({ password: 'RealPass123' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/deleted/i)
  })
})

describe('GET /profile/export', () => {
  it('requires auth (401)', async () => {
    const res = await request(app).get('/profile/export')
    expect(res.status).toBe(401)
  })
  it('returns the user\'s data bundle (200)', async () => {
    mockDb(pool, sql => {
      if (/FROM users u LEFT JOIN user_profiles/.test(sql)) return { rows: [{ user_id: 'u-1', email: 'a@x.com' }] }
      if (/FROM tasks/.test(sql)) return { rows: [{ task_id: 't1' }] }
      if (/FROM bids/.test(sql)) return { rows: [] }
      if (/FROM reviews/.test(sql)) return { rows: [] }
      if (/FROM messages/.test(sql)) return { rows: [] }
      return undefined
    })
    const res = await request(app).get('/profile/export').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.profile.user_id).toBe('u-1')
    expect(res.body.tasks).toHaveLength(1)
    expect(res.headers['content-disposition']).toMatch(/relivr-data\.json/)
  })
})
