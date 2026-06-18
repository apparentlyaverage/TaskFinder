// Login rate limiting. Lives in its OWN file: Vitest gives each file a fresh
// module registry, so the limiter's request counter starts clean here and can't
// starve the other suites (and theirs can't pre-exhaust it).
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// No real DB — failed lookups just return "no such user" so we exercise the
// limiter, not Postgres.
vi.mock('../db.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }), connect: vi.fn() },
}))

const app = (await import('../app.js')).default

describe('POST /auth/login rate limit (5 per 15 min)', () => {
  it('allows the first 5 attempts then returns 429', async () => {
    const creds = { email: 'bruteforce@example.com', password: 'whatever123' }

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/auth/login').send(creds)
      expect(res.status).toBe(401) // valid shape, wrong creds → unauthorized
    }

    const sixth = await request(app).post('/auth/login').send(creds)
    expect(sixth.status).toBe(429)
    expect(sixth.body.message).toMatch(/too many login attempts/i)
  })
})
