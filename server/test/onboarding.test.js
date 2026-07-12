// User onboarding (signup questions + Google post-OAuth completion):
//   • /auth/register accepts the new `intent` and stamps onboarded_at
//   • POST /auth/onboarding — consent + profile answers in one authed call
//   • GET /auth/me exposes intent/onboarded_at so the app knows who still owes the questions
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const token = authToken({ userId: ME, role: 'member' })

beforeEach(() => {
  vi.clearAllMocks()
  pool.query.mockResolvedValue({ rows: [] })
})

// Transaction client for /auth/register, routed by SQL like the auth.test.js one.
function registerClient(capture) {
  return {
    query: vi.fn(async (sql, params) => {
      if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return {}
      if (/SELECT user_id FROM users WHERE email/.test(sql)) return { rows: [] }
      if (/INSERT INTO users/.test(sql)) return { rows: [{ user_id: 'u-new', email: 'new@ru.ac.za', role: 'member' }] }
      if (/INSERT INTO user_profiles/.test(sql)) { capture.profileSql = sql; capture.profileParams = params; return {} }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
}

describe('POST /auth/register — intent', () => {
  it('accepts an intent and creates the profile already-onboarded (201)', async () => {
    const capture = {}
    pool.connect.mockResolvedValue(registerClient(capture))
    const res = await request(app).post('/auth/register').send({
      email: 'new@ru.ac.za', password: 'Password123', displayName: 'Naledi',
      intent: 'earn', idNumber: '8001015009087', popiaConsent: true,
    })
    expect(res.status).toBe(201)
    expect(capture.profileParams).toContain('earn')
    expect(capture.profileSql).toMatch(/intent/)
    expect(capture.profileSql).toMatch(/onboarded_at/)
  })
  it('rejects an unknown intent (422)', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'new@ru.ac.za', password: 'Password123', intent: 'lurk', popiaConsent: true,
    })
    expect(res.status).toBe(422)
  })
})

describe('POST /auth/onboarding', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/auth/onboarding').send({ intent: 'both' })
    expect(res.status).toBe(401)
  })
  it('records answers + consent and stamps onboarded_at (200)', async () => {
    let consentUpdated = false, profileSql = '', profileParams = []
    mockDb(pool, (sql, params) => {
      if (/UPDATE users SET popia_consent = TRUE/.test(sql)) { consentUpdated = true; return { rows: [], rowCount: 1 } }
      if (/FROM locations WHERE lower\(name\)/.test(sql)) return { rows: [{ location_id: 'loc-1' }] }
      if (/UPDATE user_profiles SET/.test(sql)) {
        profileSql = sql; profileParams = params
        return { rows: [{ display_name: 'Naledi', campus_zone: 'West Campus', intent: 'both', onboarded_at: '2026-07-03T10:00:00Z' }] }
      }
    })
    const res = await request(app).post('/auth/onboarding')
      .set('Authorization', `Bearer ${token}`)
      .send({ intent: 'both', campusZone: 'West Campus', skills: 'python, tutoring', popiaConsent: true })
    expect(res.status).toBe(200)
    expect(res.body.user.onboarded).toBe(true)
    expect(res.body.user.intent).toBe('both')
    expect(consentUpdated).toBe(true)
    expect(profileSql).toMatch(/onboarded_at = COALESCE\(onboarded_at, NOW\(\)\)/)
    expect(profileParams).toContain('both')
    expect(profileParams).toContain('West Campus')
  })
  it('a bare "skip" still completes onboarding (200)', async () => {
    let stamped = false
    mockDb(pool, sql => {
      if (/UPDATE user_profiles SET onboarded_at/.test(sql)) {
        stamped = true
        return { rows: [{ display_name: null, campus_zone: null, intent: null, onboarded_at: '2026-07-03T10:00:00Z' }] }
      }
    })
    const res = await request(app).post('/auth/onboarding').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(200)
    expect(res.body.user.onboarded).toBe(true)
    expect(stamped).toBe(true)
  })
  it('rejects an unknown intent (422)', async () => {
    mockDb(pool)
    const res = await request(app).post('/auth/onboarding').set('Authorization', `Bearer ${token}`).send({ intent: 'spectate' })
    expect(res.status).toBe(422)
  })
})

describe('GET /auth/me — onboarding state', () => {
  it('exposes intent + onboarded_at (and never token_version)', async () => {
    mockDb(pool, sql => {
      if (/FROM users u LEFT JOIN user_profiles/.test(sql)) return { rows: [{
        user_id: ME, email: 'g@gmail.com', role: 'member', google_id: 'g-123',
        google_avatar_url: null, popia_consent: false, token_version: 0, beta_founder: true,
        display_name: 'G User', avg_rating: null, avatar_url: null, skills: null, bio: null,
        intent: null, onboarded_at: null, campus_zone: null,
      }] }
    })
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user).toHaveProperty('intent', null)
    expect(res.body.user).toHaveProperty('onboarded_at', null)
    expect(res.body.user).toHaveProperty('campus_zone', null)
    expect(res.body.user).not.toHaveProperty('token_version')
  })
})
