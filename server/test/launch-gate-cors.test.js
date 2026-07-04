// Regression: the pre-launch gate must run AFTER cors(), so a gated 503 still
// carries Access-Control-Allow-Origin. Otherwise the browser reports a CORS
// error instead of the real 503 on every cross-origin call (prod incident,
// 2026-06-23). We activate the gate by importing the app outside test mode.
import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

// Flip out of 'test' (set by setup.js) BEFORE importing app, so the gate is live.
// The gate reads process.env.NODE_ENV per-request, and Vitest isolates env per
// file, so this does not affect other suites. Restored in afterAll regardless.
const ORIGINAL = process.env.NODE_ENV
process.env.NODE_ENV = 'production'
const { pool } = await import('../db.js')
const app = (await import('../app.js')).default
afterAll(() => { process.env.NODE_ENV = ORIGINAL })
beforeEach(() => vi.clearAllMocks())

const ALLOWED = 'http://localhost:3000' // FRONTEND_URL in setup.js

describe('pre-launch gate + CORS', () => {
  it('gated 503 still carries Access-Control-Allow-Origin for an allowed origin', async () => {
    const res = await request(app)
      .get('/notifications?unread_only=true')
      .set('Origin', ALLOWED)
    expect(res.status).toBe(503)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('OPTIONS preflight to a gated route is answered with CORS headers (204)', async () => {
    const res = await request(app)
      .options('/uploads/signature')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED)
  })
})

describe('pre-launch gate — stale-JWT DB fallback', () => {
  // A member-role token whose account was promoted in the DB after issue.
  const staleToken = authToken({ userId: 'u-promoted', role: 'member' })

  it('lets a stale member-role token through when the DB says admin (not 503)', async () => {
    pool.query.mockResolvedValue({ rows: [{ role: 'admin', email: 'owner@gmail.com' }] })
    const res = await request(app)
      .get('/search?q=fred')
      .set('Origin', ALLOWED)
      .set('Authorization', `Bearer ${staleToken}`)
    expect(res.status).not.toBe(503)
  })

  it('still 503s when the DB role is also a non-bypass member', async () => {
    pool.query.mockResolvedValue({ rows: [{ role: 'member', email: 'someone@gmail.com' }] })
    const res = await request(app)
      .get('/search?q=fred')
      .set('Origin', ALLOWED)
      .set('Authorization', `Bearer ${staleToken}`)
    expect(res.status).toBe(503)
  })

  it('fails closed (503) if the DB lookup errors', async () => {
    pool.query.mockRejectedValue(new Error('db down'))
    const res = await request(app)
      .get('/search?q=fred')
      .set('Origin', ALLOWED)
      .set('Authorization', `Bearer ${staleToken}`)
    expect(res.status).toBe(503)
  })
})
