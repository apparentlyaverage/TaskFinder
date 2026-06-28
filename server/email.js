// server/email.js — transactional email (§7.4).
//
// Provider, chosen at runtime:
//   1. GMAIL  — if GMAIL_USER + GMAIL_APP_PASSWORD are set, send via Gmail SMTP
//      (Nodemailer). This is the no-domain option: mail goes through Google as
//      the account, so SPF/DKIM/DMARC pass. Gmail forces the From address to the
//      authenticated account, so we keep the category DISPLAY NAME ("ReLivR
//      Support"/"…Updates") but rewrite the address to GMAIL_USER.
//   2. RESEND — else if RESEND_API_KEY is set (the future, once a domain is
//      verified): send via Resend's HTTP API from EMAIL_FROM_*.
//   3. STUB   — else log the message (dev/staging) so flows work end to end.
//
// Two category senders: SUPPORT (verify-email + password reset, reply-to a real
// inbox) and UPDATES (notifications + digest). Callers pass `from`/`replyTo`.
import log from './log.js'

export const EMAIL_FROM         = process.env.EMAIL_FROM         || 'ReLivR <noreply@relivr.co.za>'
export const EMAIL_FROM_SUPPORT = process.env.EMAIL_FROM_SUPPORT || 'ReLivR Support <support@relivr.co.za>'
export const EMAIL_FROM_UPDATES = process.env.EMAIL_FROM_UPDATES || 'ReLivR Updates <updates@relivr.co.za>'
export const SUPPORT_REPLY_TO   = process.env.SUPPORT_REPLY_TO   || 'support@relivr.co.za'

// Lazily-built singleton Gmail transport (reused across sends).
let _gmail
async function gmailTransport() {
  if (_gmail) return _gmail
  const { default: nodemailer } = await import('nodemailer')
  _gmail = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  })
  return _gmail
}

// Gmail rewrites the From to the authenticated account anyway — so keep the
// sender's display name but force the address to GMAIL_USER.
function gmailFrom(sender) {
  const name = /</.test(sender) ? sender.replace(/\s*<.*$/, '').trim() : 'ReLivR'
  return `${name} <${process.env.GMAIL_USER}>`
}

export async function sendEmail({ to, subject, text, html, from, replyTo }) {
  const sender = from || EMAIL_FROM

  // 1. Gmail SMTP
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const tx = await gmailTransport()
      const info = await tx.sendMail({
        from: gmailFrom(sender), to, subject, text,
        ...(html ? { html } : {}),
        ...(replyTo ? { replyTo } : {}),
      })
      log.info('email.sent', { via: 'gmail', from: gmailFrom(sender), to, subject, id: info.messageId })
      return { delivered: true }
    } catch (err) {
      log.error('email.send_error', { via: 'gmail', to, subject, msg: err.message })
      return { delivered: false }
    }
  }

  // 2. Resend (HTTP) — for when a verified domain is in place
  const key = process.env.RESEND_API_KEY
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: sender, to, subject, text, ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        log.error('email.send_failed', { via: 'resend', to, subject, status: res.status, msg: detail.slice(0, 200) })
        return { delivered: false }
      }
      log.info('email.sent', { via: 'resend', from: sender, to, subject })
      return { delivered: true }
    } catch (err) {
      log.error('email.send_error', { via: 'resend', to, subject, msg: err.message })
      return { delivered: false }
    }
  }

  // 3. Stub
  log.info('email.stub', { from: sender, to, subject, replyTo, preview: String(text || '').slice(0, 160) })
  return { delivered: false, stubbed: true }
}

export default sendEmail
