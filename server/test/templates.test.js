// Reusable + recurring task templates.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'
import { nextRun } from '../routes/templates.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const token = authToken({ userId: 'u-1' })
const TPL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

beforeEach(() => vi.clearAllMocks())

describe('nextRun', () => {
  it('returns null for none and a future date for weekly', () => {
    expect(nextRun('none')).toBeNull()
    const from = new Date('2026-06-01T00:00:00Z')
    expect(nextRun('weekly', from).toISOString()).toBe('2026-06-08T00:00:00.000Z')
  })
})

describe('POST /templates', () => {
  it('creates a template (201)', async () => {
    mockDb(pool, sql => /INSERT INTO task_templates/.test(sql) ? { rows: [{ template_id: TPL_ID }] } : undefined)
    const res = await request(app).post('/templates').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Weekly clean', description: 'Clean my room', budget: 150, recurrence: 'weekly' })
    expect(res.status).toBe(201)
    expect(res.body.template.template_id).toBe(TPL_ID)
  })
  it('requires auth (401)', async () => {
    const res = await request(app).post('/templates').send({ title: 'x', description: 'y', budget: 1 })
    expect(res.status).toBe(401)
  })
})

describe('GET /templates', () => {
  it('lists my templates (200)', async () => {
    mockDb(pool, sql => /FROM task_templates WHERE user_id/.test(sql) ? { rows: [{ template_id: TPL_ID }] } : undefined)
    const res = await request(app).get('/templates').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.templates).toHaveLength(1)
  })
})

describe('POST /templates/:id/use', () => {
  it('spawns a task from the template (201)', async () => {
    mockDb(pool, sql => {
      if (/SELECT \* FROM task_templates WHERE template_id/.test(sql)) return { rows: [{ template_id: TPL_ID, title: 'Clean', description: 'd', budget: 150, deadline_days: 7, skill_tags: [], campus_zone: null }] }
      if (/INSERT INTO tasks/.test(sql)) return { rows: [{ task_id: 't-1', title: 'Clean' }] }
      return undefined
    })
    const res = await request(app).post(`/templates/${TPL_ID}/use`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(201)
    expect(res.body.task.task_id).toBe('t-1')
  })
  it('404 when the template is missing', async () => {
    mockDb(pool, sql => /FROM task_templates WHERE template_id/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).post(`/templates/${TPL_ID}/use`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /templates/:id', () => {
  it('deletes my template (200)', async () => {
    mockDb(pool, sql => /DELETE FROM task_templates/.test(sql) ? { rows: [{ template_id: TPL_ID }] } : undefined)
    const res = await request(app).delete(`/templates/${TPL_ID}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
  it('404 when not mine / missing', async () => {
    mockDb(pool, sql => /DELETE FROM task_templates/.test(sql) ? { rows: [] } : undefined)
    const res = await request(app).delete(`/templates/${TPL_ID}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})
