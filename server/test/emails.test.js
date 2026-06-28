// The email catalog (emails.js) — each type uses the right category sender.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ delivered: true }),
  EMAIL_FROM_SUPPORT: 'ReLivR Support <support@x>',
  EMAIL_FROM_UPDATES: 'ReLivR Updates <updates@x>',
  SUPPORT_REPLY_TO: 'support@x',
}))

const { sendEmail } = await import('../email.js')
const emails = await import('../emails.js')

beforeEach(() => vi.clearAllMocks())

describe('email catalog', () => {
  it('security/account mail uses the SUPPORT sender + a reply-to + HTML', async () => {
    await emails.emailPasswordChanged('u@x.com')
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.from).toMatch(/support/i)
    expect(arg.replyTo).toBeTruthy()
    expect(arg.html).toContain('ReLivR')
  })

  it('verify email carries the verification link', async () => {
    await emails.emailVerify('u@x.com', 'https://relivr.test/verify-email?token=abc123')
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.from).toMatch(/support/i)
    expect(arg.text).toContain('token=abc123')
    expect(arg.html).toContain('token=abc123')
  })

  it('new-sign-in alert names the device', async () => {
    await emails.emailNewLogin('u@x.com', { device: 'Chrome on macOS', when: 'today' })
    expect(sendEmail.mock.calls[0][0].text).toContain('Chrome on macOS')
  })

  it('waitlist confirmation uses the UPDATES sender (no reply-to)', async () => {
    await emails.emailWaitlistConfirmation('u@x.com')
    const arg = sendEmail.mock.calls[0][0]
    expect(arg.from).toMatch(/updates/i)
    expect(arg.replyTo).toBeUndefined()
  })

  it('covers the full account lifecycle set', () => {
    for (const fn of ['emailVerify', 'emailPasswordReset', 'emailPasswordChanged', 'emailNewLogin',
      'emailAccountSuspended', 'emailAccountReinstated', 'emailAccountDeleted', 'emailWelcome',
      'emailWaitlistConfirmation']) {
      expect(typeof emails[fn]).toBe('function')
    }
  })
})
