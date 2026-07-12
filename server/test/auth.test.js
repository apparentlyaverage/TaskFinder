// Auth business logic with the Postgres pool mocked. Verifies the security-
// critical branches: password checks, JWT issuance/verification, and that a
// duplicate email can't create a second account.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

vi.mock('../db.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

beforeEach(() => {
  vi.clearAllMocks()
  // Best-effort writes (activity logs, avatar refresh) resolve harmlessly.
  pool.query.mockResolvedValue({ rows: [] })
})

describe('POST /auth/login', () => {
  it('issues a verifiable JWT on correct credentials', async () => {
    const password_hash = await bcrypt.hash('Password123', 12)
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', email: 'a@example.com', role: 'member', password_hash, display_name: 'Ada' }],
    })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'Password123' })

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ userId: 'u-1', role: 'member' })
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET)
    expect(decoded.userId).toBe('u-1')
  })

  it('rejects a wrong password with 401', async () => {
    const password_hash = await bcrypt.hash('Password123', 12)
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', email: 'a@example.com', role: 'member', password_hash }],
    })
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@example.com', password: 'WRONG' })
    expect(res.status).toBe(401)
  })

  it('rejects an unknown user with 401', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'Password123' })
    expect(res.status).toBe(401)
  })

  it('tells Google-only accounts to use Google sign-in', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u-2', email: 'g@example.com', role: 'member', password_hash: null }],
    })
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'g@example.com', password: 'Password123' })
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/google sign-in/i)
  })
})

describe('GET /auth/me', () => {
  it('rejects with no token', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('returns the user for a valid token', async () => {
    const token = jwt.sign({ userId: 'u-1', role: 'member', tv: 0 }, process.env.JWT_SECRET)
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', email: 'a@example.com', role: 'member', display_name: 'Ada', token_version: 0 }],
    })
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user.user_id).toBe('u-1')
    expect(res.body.user.token_version).toBeUndefined() // never leaked to the client
  })

  it('rejects a token whose version is stale (revoked) with 401', async () => {
    const token = jwt.sign({ userId: 'u-1', role: 'member', tv: 0 }, process.env.JWT_SECRET)
    pool.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', email: 'a@example.com', role: 'member', token_version: 1 }], // bumped since issue
    })
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/sign in again/i)
  })
})

describe('POST /auth/register', () => {
  const validBody = {
    email: 'new@example.com',
    password: 'Password123',
    displayName: 'New User',
    idNumber: '8001015009087', // valid SA ID (13-digit + Luhn)
    popiaConsent: true,
  }

  function mockClient(existingRows) {
    return {
      query: vi.fn(async (sql) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return {}
        if (/SELECT user_id FROM users WHERE email/.test(sql)) return { rows: existingRows }
        if (/INSERT INTO users/.test(sql)) return { rows: [{ user_id: 'u-new', email: validBody.email, role: 'member' }] }
        if (/INSERT INTO user_profiles/.test(sql)) return {}
        return { rows: [] }
      }),
      release: vi.fn(),
    }
  }

  it('creates a new account and returns a token (201)', async () => {
    pool.connect.mockResolvedValue(mockClient([]))
    const res = await request(app).post('/auth/register').send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user).toMatchObject({ userId: 'u-new', email: validBody.email })
  })

  it('refuses a duplicate email with 409', async () => {
    pool.connect.mockResolvedValue(mockClient([{ user_id: 'existing' }]))
    const res = await request(app).post('/auth/register').send(validBody)
    expect(res.status).toBe(409)
  })
})

describe('POST /auth/register — data-driven location validation', () => {
  const base = { email: 'loc@example.com', password: 'Password123', displayName: 'Loc', idNumber: '8001015009087', popiaConsent: true }

  function mockRegisterClient() {
    return {
      query: vi.fn(async (sql) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return {}
        if (/SELECT user_id FROM users WHERE email/.test(sql)) return { rows: [] }
        if (/INSERT INTO users/.test(sql)) return { rows: [{ user_id: 'u-loc', email: base.email, role: 'member' }] }
        return { rows: [] }
      }),
      release: vi.fn(),
    }
  }

  it('accepts a campusZone that exists in the locations table (201)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // location lookup → found
    pool.connect.mockResolvedValue(mockRegisterClient())
    const res = await request(app).post('/auth/register').send({ ...base, campusZone: 'West Campus' })
    expect(res.status).toBe(201)
  })

  it('rejects a campusZone not in the locations table (422)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }) // location lookup → not found
    const res = await request(app).post('/auth/register').send({ ...base, campusZone: 'Hogwarts' })
    expect(res.status).toBe(422)
  })

  it('fails open: a location-lookup DB error does not block registration (201)', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down')) // location lookup throws
    pool.connect.mockResolvedValue(mockRegisterClient())
    const res = await request(app).post('/auth/register').send({ ...base, campusZone: 'West Campus' })
    expect(res.status).toBe(201)
  })
})
