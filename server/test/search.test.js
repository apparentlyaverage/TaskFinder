// Universal search across people, businesses, and tasks.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

beforeEach(() => vi.clearAllMocks())

describe('GET /search', () => {
  it('returns empty results for a too-short query without querying', async () => {
    const res = await request(app).get('/search?q=a')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ users: [], businesses: [], tasks: [] })
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('returns categorized results for a real query', async () => {
    pool.query.mockImplementation(async (sql) => {
      if (/FROM users u JOIN user_profiles/.test(sql)) return { rows: [{ user_id: 'u1', display_name: 'Ada Lovelace' }] }
      if (/FROM businesses/.test(sql)) return { rows: [{ business_id: 'b1', name: 'Ada Coffee' }] }
      if (/FROM tasks t/.test(sql)) return { rows: [{ task_id: 't1', title: 'Adapt my script' }] }
      return { rows: [] }
    })
    const res = await request(app).get('/search?q=ada')
    expect(res.status).toBe(200)
    expect(res.body.users[0].display_name).toBe('Ada Lovelace')
    expect(res.body.businesses[0].name).toBe('Ada Coffee')
    expect(res.body.tasks[0].title).toBe('Adapt my script')
    // queries are parameterised with the wildcard term, not interpolated
    expect(pool.query.mock.calls[0][1][0]).toBe('%ada%')
  })

  it('returns 500 if a lookup fails', async () => {
    pool.query.mockRejectedValue(new Error('db down'))
    const res = await request(app).get('/search?q=ada')
    expect(res.status).toBe(500)
  })
})
