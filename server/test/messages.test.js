// Messaging + notifications.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME = '99999999-9999-4999-8999-999999999999'
const OTHER = '88888888-8888-4888-8888-888888888888'
const token = authToken({ userId: ME })

beforeEach(() => vi.clearAllMocks())

describe('POST /messages', () => {
  it('sends a message (201)', async () => {
    mockDb(pool, sql => /INSERT INTO messages/.test(sql) ? { rows: [{ message_id: 'm1', content: 'hi' }] } : undefined)
    const res = await request(app).post('/messages').set('Authorization', `Bearer ${token}`)
      .send({ receiver_id: OTHER, content: 'hi' })
    expect(res.status).toBe(201)
  })

  it('refuses messaging yourself (400)', async () => {
    mockDb(pool)
    const res = await request(app).post('/messages').set('Authorization', `Bearer ${token}`)
      .send({ receiver_id: ME, content: 'hi' })
    expect(res.status).toBe(400)
  })

  it('rejects empty content (422)', async () => {
    mockDb(pool)
    const res = await request(app).post('/messages').set('Authorization', `Bearer ${token}`)
      .send({ receiver_id: OTHER, content: '' })
    expect(res.status).toBe(422)
  })

  it('requires auth (401)', async () => {
    const res = await request(app).post('/messages').send({ receiver_id: OTHER, content: 'hi' })
    expect(res.status).toBe(401)
  })
})

describe('GET /notifications', () => {
  it('returns notifications with an unread count (200)', async () => {
    mockDb(pool, sql => {
      if (/SELECT COUNT/.test(sql)) return { rows: [{ count: '2' }] }
      if (/FROM notifications/.test(sql)) return { rows: [{ notification_id: 'n1' }] }
      return undefined
    })
    const res = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.unread_count).toBe(2)
    expect(res.body.notifications).toHaveLength(1)
  })
})
