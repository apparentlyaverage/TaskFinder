// Background jobs: task expiry + daily email digest.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../email.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ delivered: true }) }))

const { expireDueTasks, sendDigests, sendRecurring, expireDeals, archiveExpiredTasks } = await import('../jobs.js')
const { sendEmail } = await import('../email.js')

describe('expireDueTasks', () => {
  it('expires only open, past-deadline tasks and returns the count', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ task_id: 't1' }, { task_id: 't2' }] }) }
    const count = await expireDueTasks(db)
    expect(count).toBe(2)
    const sql = db.query.mock.calls[0][0]
    expect(sql).toMatch(/status = 'expired'/)
    expect(sql).toMatch(/status = 'open' AND deadline < NOW\(\)/)
  })

  it('returns 0 when nothing is due', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    expect(await expireDueTasks(db)).toBe(0)
  })
})

describe('expireDeals', () => {
  it('expires only active, past-expiry deals and returns the count', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ deal_id: 'd1' }] }) }
    expect(await expireDeals(db)).toBe(1)
    const sql = db.query.mock.calls[0][0]
    expect(sql).toMatch(/status = 'expired'/)
    expect(sql).toMatch(/status = 'active' AND expires_at <= NOW\(\)/)
  })
  it('returns 0 when nothing has lapsed', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    expect(await expireDeals(db)).toBe(0)
  })
})

describe('archiveExpiredTasks', () => {
  it('archives past-TTL or stale terminal tasks and returns the count', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ task_id: 't1' }, { task_id: 't2' }] }) }
    expect(await archiveExpiredTasks(db)).toBe(2)
    const sql = db.query.mock.calls[0][0]
    expect(sql).toMatch(/SET archived_at = NOW\(\)/)
    expect(sql).toMatch(/archived_at IS NULL/)
    expect(sql).toMatch(/expires_at < NOW\(\)/)
  })
  it('returns 0 when nothing qualifies', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    expect(await archiveExpiredTasks(db)).toBe(0)
  })
})

describe('sendDigests', () => {
  beforeEach(() => vi.clearAllMocks())

  it('emails a daily user with new notifications and stamps last_digest_at', async () => {
    let stamped = false
    const db = { query: vi.fn(async (sql) => {
      if (/email_frequency = 'daily'/.test(sql)) return { rows: [{ user_id: 'u1', email: 'a@x.com', last_digest_at: null }] }
      if (/FROM notifications/.test(sql)) return { rows: [{ title: 'New bid', body: 'b' }, { title: 'New message', body: 'c' }] }
      if (/UPDATE users SET last_digest_at/.test(sql)) { stamped = true; return {} }
      return { rows: [] }
    }) }
    const n = await sendDigests(db)
    expect(n).toBe(1)
    expect(stamped).toBe(true)
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/2 updates/)
  })

  it('skips a daily user with no new notifications (no email, no stamp)', async () => {
    const db = { query: vi.fn(async (sql) => {
      if (/email_frequency = 'daily'/.test(sql)) return { rows: [{ user_id: 'u1', email: 'a@x.com', last_digest_at: null }] }
      if (/FROM notifications/.test(sql)) return { rows: [] }
      return { rows: [] }
    }) }
    expect(await sendDigests(db)).toBe(0)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('sendRecurring', () => {
  it('spawns a task for a due recurring template and advances next_run_at', async () => {
    let spawnedTask = false, advanced = false
    const db = { query: vi.fn(async (sql) => {
      if (/FROM task_templates/.test(sql)) return { rows: [{ template_id: 'tpl1', user_id: 'u1', title: 'Clean', description: 'd', budget: 150, deadline_days: 7, skill_tags: [], campus_zone: null, recurrence: 'weekly' }] }
      if (/INSERT INTO tasks/.test(sql)) { spawnedTask = true; return { rows: [{ task_id: 't1' }] } }
      if (/UPDATE task_templates SET next_run_at/.test(sql)) { advanced = true; return {} }
      return { rows: [] }
    }) }
    expect(await sendRecurring(db)).toBe(1)
    expect(spawnedTask).toBe(true)
    expect(advanced).toBe(true)
  })

  it('does nothing when no templates are due', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    expect(await sendRecurring(db)).toBe(0)
  })
})
