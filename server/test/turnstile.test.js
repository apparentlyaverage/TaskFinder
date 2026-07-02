// Turnstile bot-check on the public landing endpoints (/waitlist, /feedback).
// The secret is set BEFORE app import (fresh module registry per test file) so
// the middleware runs in configured mode; beta.test.js covers the unconfigured
// pass-through. Cloudflare's siteverify call is stubbed via global fetch.
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import { mockDb } from './helpers.js'

process.env.TURNSTILE_SECRET = 'test-turnstile-secret'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

afterAll(() => { delete process.env.TURNSTILE_SECRET })
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('Turnstile-guarded endpoints (secret configured)', () => {
  it('403s /waitlist without a turnstileToken', async () => {
    mockDb(pool)
    const res = await request(app).post('/waitlist').send({ email: 'a@b.co' })
    expect(res.status).toBe(403)
  })
  it('403s /feedback when Cloudflare rejects the token', async () => {
    mockDb(pool)
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) })))
    const res = await request(app).post('/feedback').send({ message: 'hello there', turnstileToken: 'bad' })
    expect(res.status).toBe(403)
  })
  it('accepts /waitlist when Cloudflare verifies the token (201)', async () => {
    let inserted = false
    mockDb(pool, sql => { if (/INSERT INTO waitlist/.test(sql)) { inserted = true; return { rows: [] } } })
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true }) })))
    const res = await request(app).post('/waitlist').send({ email: 'a@b.co', turnstileToken: 'good' })
    expect(res.status).toBe(201)
    expect(inserted).toBe(true)
  })
  it('403s (fail-closed) when the verify call itself errors', async () => {
    mockDb(pool)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const res = await request(app).post('/feedback').send({ message: 'hello there', turnstileToken: 'tok' })
    expect(res.status).toBe(403)
  })
})
