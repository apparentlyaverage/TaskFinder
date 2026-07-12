// Batch 6 — student email mapping: attach + verify a university email to unlock
// student perks. Anyone joins with any email; this is the separate student proof.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const token = authToken({ userId: 'stu-1', role: 'member' })

// Route the student_domains lookup: any *.ac.za university returns a label, else [].
function domainRow(sql, params) {
  if (/FROM student_domains/.test(sql)) {
    const d = params?.[0] || ''
    return /ac\.za$/.test(d) ? { rows: [{ domain: d.replace(/^.*\./, '').length ? d : d, label: 'Rhodes University' }] } : { rows: [] }
  }
  return undefined
}

beforeEach(() => vi.clearAllMocks())

describe('POST /auth/student-email', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/auth/student-email').send({ studentEmail: 'g21@ru.ac.za' })
    expect(res.status).toBe(401)
  })
  it('202/200 stores a pending university email and emails a link', async () => {
    let updated = false
    mockDb(pool, (sql, params) => {
      const dr = domainRow(sql, params); if (dr) return dr
      if (/SELECT 1 FROM users WHERE lower\(student_email\)/.test(sql)) return { rows: [] } // not taken
      if (/UPDATE users SET student_email = \$1, student_email_verified_at = NULL/.test(sql)) { updated = true; return { rowCount: 1 } }
      if (/INSERT INTO auth_tokens/.test(sql)) return { rows: [] }
    })
    const res = await request(app).post('/auth/student-email').set('Authorization', `Bearer ${token}`).send({ studentEmail: 'g21012345@ru.ac.za' })
    expect(res.status).toBe(200)
    expect(res.body.pending).toBe(true)
    expect(updated).toBe(true)
  })
  it('422s a non-university email', async () => {
    mockDb(pool, (sql, params) => domainRow(sql, params))
    const res = await request(app).post('/auth/student-email').set('Authorization', `Bearer ${token}`).send({ studentEmail: 'me@gmail.com' })
    expect(res.status).toBe(422)
  })
  it('422s a malformed email', async () => {
    mockDb(pool)
    const res = await request(app).post('/auth/student-email').set('Authorization', `Bearer ${token}`).send({ studentEmail: 'not-an-email' })
    expect(res.status).toBe(422)
  })
  it('409s when the student email is already verified elsewhere', async () => {
    mockDb(pool, (sql, params) => {
      const dr = domainRow(sql, params); if (dr) return dr
      if (/SELECT 1 FROM users WHERE lower\(student_email\)/.test(sql)) return { rows: [{ '?column?': 1 }] } // taken
    })
    const res = await request(app).post('/auth/student-email').set('Authorization', `Bearer ${token}`).send({ studentEmail: 'shared@ru.ac.za' })
    expect(res.status).toBe(409)
  })
})

describe('POST /auth/student-email/verify', () => {
  it('200s and marks verified for a valid token', async () => {
    let verified = false
    mockDb(pool, (sql, params) => {
      if (/FROM auth_tokens[\s\S]*student_email_verify/.test(sql)) return { rows: [{ token_id: 'tok-1', user_id: 'stu-1' }] }
      if (/SELECT student_email FROM users/.test(sql)) return { rows: [{ student_email: 'g21@ru.ac.za' }] }
      const dr = domainRow(sql, params); if (dr) return dr
      if (/UPDATE users SET student_email_verified_at = NOW\(\)/.test(sql)) { verified = true; return { rowCount: 1 } }
      if (/UPDATE auth_tokens SET used_at/.test(sql)) return { rowCount: 1 }
    })
    const res = await request(app).post('/auth/student-email/verify').send({ token: 'raw-token' })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/verified/i)
    expect(verified).toBe(true)
  })
  it('400s an invalid/expired token', async () => {
    mockDb(pool, sql => /FROM auth_tokens/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).post('/auth/student-email/verify').send({ token: 'bad' })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /auth/student-email', () => {
  it('204s and unlinks', async () => {
    let cleared = false
    mockDb(pool, sql => { if (/UPDATE users SET student_email = NULL/.test(sql)) { cleared = true; return { rowCount: 1 } } })
    const res = await request(app).delete('/auth/student-email').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
    expect(cleared).toBe(true)
  })
})

describe('GET /auth/me — student status', () => {
  it('exposes student_verified based on student_email_verified_at', async () => {
    mockDb(pool, sql => /FROM users u LEFT JOIN user_profiles/.test(sql) ? { rows: [{
      user_id: 'stu-1', email: 'me@gmail.com', role: 'member', token_version: 0,
      student_email: 'g21@ru.ac.za', student_email_verified_at: '2026-07-12T00:00:00Z',
      display_name: 'Thabo', intent: null, onboarded_at: null, campus_zone: null,
    }] } : undefined)
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user.student_verified).toBe(true)
    expect(res.body.user.student_email).toBe('g21@ru.ac.za')
    expect(res.body.user).not.toHaveProperty('token_version')
  })
})
