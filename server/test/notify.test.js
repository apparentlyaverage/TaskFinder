// createNotification: in-app insert + opt-out-aware activity email.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))
vi.mock('../email.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ delivered: true }), EMAIL_FROM: 'x', EMAIL_FROM_UPDATES: 'x' }))

const { pool } = await import('../db.js')
const { sendEmail } = await import('../email.js')
const { createNotification } = await import('../notify.js')

const flush = () => new Promise(r => setTimeout(r, 10))
function userRow(row) {
  pool.query.mockImplementation(async (sql) =>
    /SELECT email, email_frequency FROM users/.test(sql) ? { rows: [row] } : { rows: [] })
}

beforeEach(() => vi.clearAllMocks())

describe('createNotification activity email', () => {
  it('emails an instant-cadence recipient', async () => {
    userRow({ email: 'a@x.com', email_frequency: 'instant' })
    await createNotification({ userId: 'u1', type: 'bid.submitted', title: 'New bid', body: 'b' })
    await flush()
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendEmail.mock.calls[0][0].to).toBe('a@x.com')
  })

  it('does NOT instant-email a daily-digest recipient (batched by the job)', async () => {
    userRow({ email: 'a@x.com', email_frequency: 'daily' })
    await createNotification({ userId: 'u1', type: 't', title: 'x', body: 'b' })
    await flush()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does NOT email an off recipient', async () => {
    userRow({ email: 'a@x.com', email_frequency: 'off' })
    await createNotification({ userId: 'u1', type: 't', title: 'x', body: 'b' })
    await flush()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('does NOT email a deleted/anonymised recipient', async () => {
    userRow({ email: 'deleted-u1@deleted.local', email_frequency: 'instant' })
    await createNotification({ userId: 'u1', type: 't', title: 'x', body: 'b' })
    await flush()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('still records the in-app notification even if the email lookup fails', async () => {
    let insertCalled = false
    pool.query.mockImplementation(async (sql) => {
      if (/INSERT INTO notifications/.test(sql)) { insertCalled = true; return { rows: [] } }
      throw new Error('email lookup boom')
    })
    await createNotification({ userId: 'u1', type: 't', title: 'x', body: 'b' })
    await flush()
    expect(insertCalled).toBe(true) // notification persisted; email failure swallowed
  })
})
