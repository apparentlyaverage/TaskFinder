// GET /locations — the data-driven campus/zone taxonomy that lets ReLivR add a
// campus without a redeploy. Pool mocked.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../db.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

beforeEach(() => vi.clearAllMocks())

describe('GET /locations', () => {
  it('nests zones under their campus', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { location_id: 'c1', name: 'Rhodes University', kind: 'campus', parent_id: null, sort_order: 0 },
        { location_id: 'z1', name: 'West Campus', kind: 'zone', parent_id: 'c1', sort_order: 0 },
        { location_id: 'z2', name: 'East Campus', kind: 'zone', parent_id: 'c1', sort_order: 1 },
      ],
    })
    const res = await request(app).get('/locations')
    expect(res.status).toBe(200)
    expect(res.body.campuses).toHaveLength(1)
    expect(res.body.campuses[0].name).toBe('Rhodes University')
    expect(res.body.campuses[0].zones).toHaveLength(2)
  })

  it('returns a flat filtered list for ?kind=campus', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ location_id: 'c1', name: 'Rhodes University', kind: 'campus', parent_id: null }],
    })
    const res = await request(app).get('/locations?kind=campus')
    expect(res.status).toBe(200)
    expect(res.body.locations).toHaveLength(1)
    expect(pool.query.mock.calls[0][1]).toEqual(['campus']) // parameterised, not interpolated
  })

  it('returns 500 if the lookup fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'))
    const res = await request(app).get('/locations')
    expect(res.status).toBe(500)
  })
})
