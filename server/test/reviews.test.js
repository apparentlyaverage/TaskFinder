// Reviews / 5-star ratings — the trust layer. Postgres pool mocked. Covers the
// security-critical branches: completion gate, participant-only, no self-review,
// one-per-task, rating bounds, comment cap.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

vi.mock('../db.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TASK_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const token = jwt.sign({ userId: ME, role: 'member', tv: 0 }, process.env.JWT_SECRET)

// A transaction client whose query() responds based on the SQL it sees.
function mockClient(task, { insertThrows } = {}) {
  return {
    query: vi.fn(async (sql) => {
      if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return {}
      if (/FROM tasks WHERE task_id/.test(sql)) return { rows: task ? [task] : [] }
      if (/INSERT INTO reviews/.test(sql)) {
        if (insertThrows) throw insertThrows
        return { rows: [{ review_id: 'r-1', task_id: TASK_ID, rating: 5 }] }
      }
      if (/AVG\(rating\)/.test(sql)) return { rows: [{ avg_rating: 5, rating_count: 1 }] }
      if (/UPDATE user_profiles/.test(sql)) return {}
      return { rows: [] }
    }),
    release: vi.fn(),
  }
}

const completedTask = { task_id: TASK_ID, creator_id: ME, assigned_to: OTHER, status: 'completed', title: 'Fix my bike' }

beforeEach(() => {
  vi.clearAllMocks()
  // Default covers requireAuth's token_version lookup (matches tv:0 in the token)
  // and the best-effort notification insert. Data queries use mockResolvedValueOnce.
  pool.query.mockResolvedValue({ rows: [{ token_version: 0 }] })
})

describe('POST /reviews', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/reviews').send({ task_id: TASK_ID, rating: 5 })
    expect(res.status).toBe(401)
  })

  it('lets a participant review the counterparty on a completed task (201)', async () => {
    pool.connect.mockResolvedValue(mockClient(completedTask))
    const res = await request(app)
      .post('/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 5, comment: 'Great work' })
    expect(res.status).toBe(201)
    expect(res.body.review).toMatchObject({ review_id: 'r-1' })
  })

  it('refuses to review a task that is not completed (409)', async () => {
    pool.connect.mockResolvedValue(mockClient({ ...completedTask, status: 'in_progress' }))
    const res = await request(app)
      .post('/reviews').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 5 })
    expect(res.status).toBe(409)
  })

  it('rejects a non-participant (403)', async () => {
    pool.connect.mockResolvedValue(mockClient({ ...completedTask, creator_id: 'x', assigned_to: 'y' }))
    const res = await request(app)
      .post('/reviews').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 5 })
    expect(res.status).toBe(403)
  })

  it('blocks self-review when creator is also the assignee (400)', async () => {
    pool.connect.mockResolvedValue(mockClient({ ...completedTask, creator_id: ME, assigned_to: ME }))
    const res = await request(app)
      .post('/reviews').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 5 })
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/yourself/i)
  })

  it('maps a unique-violation to "already reviewed" (409)', async () => {
    pool.connect.mockResolvedValue(mockClient(completedTask, { insertThrows: { code: '23505' } }))
    const res = await request(app)
      .post('/reviews').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 5 })
    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already reviewed/i)
  })

  it('rejects a rating outside 1–5 (422)', async () => {
    const res = await request(app)
      .post('/reviews').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 6 })
    expect(res.status).toBe(422)
  })

  it('rejects an over-long comment (422)', async () => {
    const res = await request(app)
      .post('/reviews').set('Authorization', `Bearer ${token}`)
      .send({ task_id: TASK_ID, rating: 5, comment: 'x'.repeat(2001) })
    expect(res.status).toBe(422)
  })
})

describe('GET /reviews/user/:userId', () => {
  it('returns the summary and recent reviews', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ review_id: 'r-1', rating: 5, reviewer_name: 'Ada' }] })
      .mockResolvedValueOnce({ rows: [{ avg_rating: 5, rating_count: 1 }] })
    const res = await request(app).get(`/reviews/user/${OTHER}`)
    expect(res.status).toBe(200)
    expect(res.body.summary).toMatchObject({ avg_rating: 5, rating_count: 1 })
    expect(res.body.reviews).toHaveLength(1)
  })
})
