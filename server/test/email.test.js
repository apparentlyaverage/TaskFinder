// Transactional email sender (§7.4) — two category senders (support / updates).
import { describe, it, expect } from 'vitest'
import { sendEmail, EMAIL_FROM, EMAIL_FROM_SUPPORT, EMAIL_FROM_UPDATES, SUPPORT_REPLY_TO } from '../email.js'

describe('email sender', () => {
  it('defaults to a noreply sender', () => {
    expect(EMAIL_FROM).toMatch(/noreply@/i)
  })

  it('has distinct support + updates senders', () => {
    expect(EMAIL_FROM_SUPPORT).toMatch(/support@/i)
    expect(EMAIL_FROM_UPDATES).toMatch(/updates@/i)
    expect(EMAIL_FROM_SUPPORT).not.toBe(EMAIL_FROM_UPDATES)
    expect(SUPPORT_REPLY_TO).toMatch(/@/)
  })

  it('stubs (logs) instead of sending when no provider key is set', async () => {
    const r = await sendEmail({ to: 'x@example.com', subject: 'Hi', text: 'body' })
    expect(r).toMatchObject({ stubbed: true, delivered: false })
  })

  it('accepts a category sender + replyTo without error (stubbed)', async () => {
    const r = await sendEmail({ to: 'x@example.com', subject: 'Reset', text: 'body', from: EMAIL_FROM_SUPPORT, replyTo: SUPPORT_REPLY_TO })
    expect(r).toMatchObject({ stubbed: true })
  })
})
