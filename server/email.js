// server/email.js — transactional email (§7.4).
// All ReLivR mail goes out from a single noreply sender (EMAIL_FROM). A real
// provider (Resend) is used when RESEND_API_KEY is set; otherwise the message
// is logged (dev/staging) so the auth + notification flows work end to end.
// Swap the provider block for any HTTP/SMTP provider — callers don't change.
import log from './log.js'

// Default sender for the time being — override with a verified domain via env.
export const EMAIL_FROM = process.env.EMAIL_FROM || 'ReLivR <noreply@relivr.co.za>'

export async function sendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // No provider configured — log instead of sending (dev/staging).
    log.info('email.stub', { from: EMAIL_FROM, to, subject, preview: String(text || '').slice(0, 160) })
    return { delivered: false, stubbed: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, ...(html ? { html } : {}) }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      log.error('email.send_failed', { to, subject, status: res.status, msg: detail.slice(0, 200) })
      return { delivered: false }
    }
    log.info('email.sent', { from: EMAIL_FROM, to, subject })
    return { delivered: true }
  } catch (err) {
    log.error('email.send_error', { to, subject, msg: err.message })
    return { delivered: false }
  }
}

export default sendEmail
