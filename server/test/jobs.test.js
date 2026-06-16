// Background jobs: task expiry + daily email digest.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../email.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ delivered: true }) }))

const { expireDueTasks, sendDigests } = await import('../jobs.js')
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
