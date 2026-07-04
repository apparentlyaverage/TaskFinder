// PATCH /profile — personal avatar. Validates the new avatarUrl field: https
// only (blocks javascript:/data: stored-XSS in the rendered <img>), and an empty
// string clears it.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb, mockClient } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const token = authToken({ userId: 'u-1', role: 'member' })
beforeEach(() => vi.clearAllMocks())

describe('PATCH /profile — avatar', () => {
  it('saves a valid https avatar URL (200)', async () => {
    let saved
    pool.connect.mockResolvedValue(mockClient((sql, params) => {
      if (/UPDATE user_profiles SET/.test(sql) && /avatar_url/.test(sql)) { saved = params[0]; return {} }
    }))
    mockDb(pool, sql => {
      if (/SELECT u\.user_id/.test(sql)) return { rows: [{ user_id: 'u-1', avatar_url: 'https://res.cloudinary.com/x/a.png' }] }
    })
    const res = await request(app).patch('/profile').set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'https://res.cloudinary.com/x/a.png' })
    expect(res.status).toBe(200)
    expect(saved).toBe('https://res.cloudinary.com/x/a.png')
    expect(res.body.profile.avatar_url).toBe('https://res.cloudinary.com/x/a.png')
  })

  it('rejects a javascript: scheme (422)', async () => {
    mockDb(pool)
    const res = await request(app).patch('/profile').set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'javascript:alert(1)' })
    expect(res.status).toBe(422)
  })

  it('rejects a non-https avatar URL (422)', async () => {
    mockDb(pool)
    const res = await request(app).patch('/profile').set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'http://evil.example/x.png' })
    expect(res.status).toBe(422)
  })

  it('clears the avatar with an empty string (200 → null)', async () => {
    let saved = 'unset'
    pool.connect.mockResolvedValue(mockClient((sql, params) => {
      if (/UPDATE user_profiles SET/.test(sql) && /avatar_url/.test(sql)) { saved = params[0]; return {} }
    }))
    mockDb(pool, sql => { if (/SELECT u\.user_id/.test(sql)) return { rows: [{ user_id: 'u-1', avatar_url: null }] } })
    const res = await request(app).patch('/profile').set('Authorization', `Bearer ${token}`)
      .send({ avatarUrl: '' })
    expect(res.status).toBe(200)
    expect(saved).toBe(null)
  })
})
