// Security & input-validation surface — no database required. Everything here
// is rejected by middleware/validators before any route touches Postgres.
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../app.js'

describe('hardening: headers & 404', () => {
  it('sets helmet security headers', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers).toHaveProperty('x-frame-options')
  })

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/no-such-route')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'Not found.' })
  })
})

describe('requireAuth middleware', () => {
  it('rejects a protected route with no token', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x' })
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/authentication required/i)
  })

  it('rejects a protected route with a garbage token', async () => {
    const res = await request(app)
      .post('/tasks')
      .set('Authorization', 'Bearer not.a.real.jwt')
      .send({ title: 'x' })
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid or expired/i)
  })
})

describe('input validation (pre-DB)', () => {
  it('rejects registration with a malformed email', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'longenough1', popiaConsent: true })
    expect(res.status).toBe(422)
  })

  it('rejects registration with a too-short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'short', popiaConsent: true })
    expect(res.status).toBe(422)
  })

  it('rejects registration without POPIA consent', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'a@example.com', password: 'longenough1' })
    expect(res.status).toBe(422)
  })

  it('rejects login missing a password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@example.com' })
    expect(res.status).toBe(422)
  })
})
