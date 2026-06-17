// Data-driven categories taxonomy.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

beforeEach(() => vi.clearAllMocks())

describe('GET /categories', () => {
  it('returns active categories ordered by sort_order', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ category_id: 'c1', name: 'Tech & Coding', icon: '💻', keywords: ['python'] }],
    })
    const res = await request(app).get('/categories')
    expect(res.status).toBe(200)
    expect(res.body.categories[0].name).toBe('Tech & Coding')
    expect(pool.query.mock.calls[0][0]).toMatch(/is_active = TRUE/)
  })

  it('returns 500 on a lookup failure', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get('/categories')
    expect(res.status).toBe(500)
  })
})
