// Task draft system (epic batch 2): drafts save incomplete (title only),
// stay private to their creator on every read surface, publish only when
// complete, and can be discarded. Live-post validation is unchanged.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TASK  = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const meToken    = authToken({ userId: ME, role: 'member' })
const otherToken = authToken({ userId: OTHER, role: 'member' })

beforeEach(() => { vi.clearAllMocks(); pool.query.mockResolvedValue({ rows: [] }) })

describe('POST /tasks — drafts', () => {
  it('saves a title-only draft (201) with status=draft and NULL fields', async () => {
    let inserted
    mockDb(pool, (sql, params) => {
      if (/INSERT INTO tasks/.test(sql)) { inserted = params; return { rows: [{ task_id: TASK, status: 'draft' }] } }
    })
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${meToken}`)
      .send({ title: 'Fix my Python script', status: 'draft' })
    expect(res.status).toBe(201)
    expect(inserted).toContain('draft')
    expect(inserted[2]).toBe(null) // description
    expect(inserted[3]).toBe(null) // budget
    expect(inserted[4]).toBe(null) // deadline
  })
  it('still requires the full contract for a live post (422 without description)', async () => {
    mockDb(pool)
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${meToken}`)
      .send({ title: 'Fix my Python script', budget: 100, deadline: new Date(Date.now() + 86400000).toISOString() })
    expect(res.status).toBe(422)
  })
  it('rejects a draft with no title (422)', async () => {
    mockDb(pool)
    const res = await request(app).post('/tasks').set('Authorization', `Bearer ${meToken}`)
      .send({ status: 'draft' })
    expect(res.status).toBe(422)
  })
})

describe('draft privacy', () => {
  it('GET /tasks?status=draft is refused (403) — drafts never list publicly', async () => {
    mockDb(pool)
    const res = await request(app).get('/tasks?status=draft')
    expect(res.status).toBe(403)
  })
  it('GET /tasks/:id hides a draft from anonymous viewers (404)', async () => {
    mockDb(pool, sql => {
      if (/FROM tasks t LEFT JOIN user_profiles/.test(sql)) return { rows: [{ task_id: TASK, status: 'draft', creator_id: ME }] }
    })
    const res = await request(app).get(`/tasks/${TASK}`)
    expect(res.status).toBe(404)
  })
  it('GET /tasks/:id hides a draft from OTHER signed-in users (404)', async () => {
    mockDb(pool, sql => {
      if (/FROM tasks t LEFT JOIN user_profiles/.test(sql)) return { rows: [{ task_id: TASK, status: 'draft', creator_id: ME }] }
    })
    const res = await request(app).get(`/tasks/${TASK}`).set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(404)
  })
  it('GET /tasks/:id shows the draft to its creator (200)', async () => {
    mockDb(pool, sql => {
      if (/FROM tasks t LEFT JOIN user_profiles/.test(sql)) return { rows: [{ task_id: TASK, status: 'draft', creator_id: ME }] }
      if (/FROM bids b JOIN user_profiles/.test(sql)) return { rows: [] }
    })
    const res = await request(app).get(`/tasks/${TASK}`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(200)
    expect(res.body.task.status).toBe('draft')
  })
})

describe('PATCH /tasks/:id/publish', () => {
  const complete = { task_id: TASK, creator_id: ME, status: 'draft', title: 'Fix my Python script',
    description: 'It crashes on import and I need it working by Friday.', budget: '150.00',
    deadline: new Date(Date.now() + 86400000 * 7).toISOString() }

  it('publishes a complete draft (200 → open, created_at bumped)', async () => {
    let updateSql = ''
    mockDb(pool, (sql) => {
      if (/SELECT \* FROM tasks WHERE task_id/.test(sql)) return { rows: [complete] }
      if (/UPDATE tasks SET status = 'open', created_at = NOW\(\)/.test(sql)) { updateSql = sql; return { rows: [{ ...complete, status: 'open' }] } }
    })
    const res = await request(app).patch(`/tasks/${TASK}/publish`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(200)
    expect(res.body.task.status).toBe('open')
    expect(updateSql).toMatch(/created_at = NOW\(\)/)
  })
  it('422s an incomplete draft and names the missing fields', async () => {
    mockDb(pool, sql => {
      if (/SELECT \* FROM tasks WHERE task_id/.test(sql)) return { rows: [{ ...complete, budget: null, deadline: null }] }
    })
    const res = await request(app).patch(`/tasks/${TASK}/publish`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(422)
    expect(res.body.missing).toEqual(expect.arrayContaining(['a budget', 'a deadline']))
  })
  it('409s when the task is not a draft', async () => {
    mockDb(pool, sql => {
      if (/SELECT \* FROM tasks WHERE task_id/.test(sql)) return { rows: [{ ...complete, status: 'open' }] }
    })
    const res = await request(app).patch(`/tasks/${TASK}/publish`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(409)
  })
  it("404s another user's draft", async () => {
    mockDb(pool, sql => {
      if (/SELECT \* FROM tasks WHERE task_id/.test(sql)) return { rows: [] } // creator filter excludes it
    })
    const res = await request(app).patch(`/tasks/${TASK}/publish`).set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /tasks/:id — discard draft', () => {
  it('hard-deletes my draft (200)', async () => {
    mockDb(pool, sql => {
      if (/DELETE FROM tasks WHERE task_id/.test(sql)) return { rows: [{ task_id: TASK }] }
    })
    const res = await request(app).delete(`/tasks/${TASK}`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(200)
  })
  it('404s a non-draft (live tasks must be cancelled, not deleted)', async () => {
    mockDb(pool, sql => {
      if (/DELETE FROM tasks WHERE task_id/.test(sql)) return { rows: [] } // status='draft' filter excluded it
    })
    const res = await request(app).delete(`/tasks/${TASK}`).set('Authorization', `Bearer ${meToken}`)
    expect(res.status).toBe(404)
  })
})
