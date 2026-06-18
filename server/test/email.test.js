// Transactional email sender (§7.4).
import { describe, it, expect } from 'vitest'
import { sendEmail, EMAIL_FROM } from '../email.js'

describe('email sender', () => {
  it('defaults to a noreply sender', () => {
    expect(EMAIL_FROM).toMatch(/noreply@/i)
  })

  it('stubs (logs) instead of sending when no provider key is set', async () => {
    const r = await sendEmail({ to: 'x@example.com', subject: 'Hi', text: 'body' })
    expect(r).toMatchObject({ stubbed: true, delivered: false })
  })
})
