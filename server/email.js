// server/email.js — transactional email (§7.4).
// Mail goes from one of two category senders:
//   • SUPPORT (security/auth — "verify your email", password reset): EMAIL_FROM_SUPPORT,
//     with reply_to set so a user replying actually reaches a monitored inbox.
//   • UPDATES (activity — notifications, daily digest): EMAIL_FROM_UPDATES (no-reply).
// EMAIL_FROM stays as the generic default for any caller that doesn't pick one.
// Resend is used when RESEND_API_KEY is set; otherwise the message is logged
// (dev/staging) so the auth + notification flows still work end to end.
import log from './log.js'

export const EMAIL_FROM         = process.env.EMAIL_FROM         || 'ReLivR <noreply@relivr.co.za>'
export const EMAIL_FROM_SUPPORT = process.env.EMAIL_FROM_SUPPORT || 'ReLivR Support <support@relivr.co.za>'
export const EMAIL_FROM_UPDATES = process.env.EMAIL_FROM_UPDATES || 'ReLivR Updates <updates@relivr.co.za>'
// Where replies to support/security mail land (a real, monitored inbox).
export const SUPPORT_REPLY_TO   = process.env.SUPPORT_REPLY_TO   || 'support@relivr.co.za'

export async function sendEmail({ to, subject, text, html, from, replyTo }) {
  const sender = from || EMAIL_FROM
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // No provider configured — log instead of sending (dev/staging).
    log.info('email.stub', { from: sender, to, subject, replyTo, preview: String(text || '').slice(0, 160) })
    return { delivered: false, stubbed: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender, to, subject, text,
        ...(html ? { html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      log.error('email.send_failed', { to, subject, status: res.status, msg: detail.slice(0, 200) })
      return { delivered: false }
    }
    log.info('email.sent', { from: sender, to, subject })
    return { delivered: true }
  } catch (err) {
    log.error('email.send_error', { to, subject, msg: err.message })
    return { delivered: false }
  }
}

export default sendEmail
