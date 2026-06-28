// server/emails.js — the email catalog. One function per email type, each with a
// branded HTML + plain-text body and the correct category sender (support vs
// updates). The full plan + which triggers fire each one is in docs/EMAILS.md.
// Activity emails (bids, messages, reviews, follows, …) are delivered via
// notify.createNotification and are NOT duplicated here.
import { sendEmail, EMAIL_FROM_SUPPORT, EMAIL_FROM_UPDATES, SUPPORT_REPLY_TO } from './email.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// ── tiny, email-client-safe template helpers (inline styles only) ──
function layout(title, bodyHtml, footer) {
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#211c2e;background:#ffffff">
  <div style="font-family:Georgia,serif;font-weight:800;font-size:22px;color:#5b21b6;margin-bottom:18px">ReLivR</div>
  ${title ? `<h1 style="font-size:18px;margin:0 0 12px">${title}</h1>` : ''}
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #ececec;margin:26px 0 14px">
  <div style="font-size:12px;color:#9a93a6">${footer}</div>
</div>`
}
const p = (t) => `<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${t}</p>`
const button = (href, label) => `<p style="margin:18px 0"><a href="${href}" style="background:#5b21b6;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;display:inline-block">${label}</a></p>`
const SUPPORT_FOOTER = 'Didn’t expect this? Just reply — you’ll reach a real person at ReLivR Support.'
const UPDATES_FOOTER = 'You’re getting this because ReLivR notifications are on. Change the frequency in Profile → Security.'

const support = (to, subject, text, html) => sendEmail({ to, subject, text, html, from: EMAIL_FROM_SUPPORT, replyTo: SUPPORT_REPLY_TO })
const updates = (to, subject, text, html) => sendEmail({ to, subject, text, html, from: EMAIL_FROM_UPDATES })

// ── SECURITY / ACCOUNT (support sender) ──────────────────────────────────────
export const emailVerify = (to, link) => support(to,
  'Verify your ReLivR email',
  `Welcome to ReLivR! Verify your email:\n${link}`,
  layout('Confirm your email',
    p('Welcome to ReLivR! Tap below to verify your email and finish setting up your account.') +
    button(link, 'Verify email') +
    p(`<span style="font-size:12px;color:#9a93a6">Or paste this link: ${link}</span>`), SUPPORT_FOOTER))

export const emailPasswordReset = (to, link) => support(to,
  'Reset your ReLivR password',
  `Reset your ReLivR password (valid 1 hour):\n${link}`,
  layout('Reset your password',
    p('We got a request to reset your password. This link is valid for 1 hour.') +
    button(link, 'Reset password') +
    p('<span style="font-size:12px;color:#9a93a6">Didn’t request this? Ignore this email — your password won’t change.</span>'), SUPPORT_FOOTER))

export const emailPasswordChanged = (to) => support(to,
  'Your ReLivR password was changed',
  'Your ReLivR password was just changed and all sessions were signed out. If this wasn’t you, reply to this email and reset your password.',
  layout('Password changed',
    p('Your ReLivR password was just changed, and you’ve been signed out everywhere.') +
    p('<strong>If this wasn’t you</strong>, reply to this email right away and reset your password from the sign-in page.'), SUPPORT_FOOTER))

export const emailNewLogin = (to, { device, when }) => support(to,
  'New sign-in to your ReLivR account',
  `A new device just signed in to your ReLivR account.\nDevice: ${device}\nWhen: ${when}\n\nIf this wasn’t you, reply to this email and reset your password.`,
  layout('New sign-in detected',
    p('A new device just signed in to your ReLivR account:') +
    p(`<strong>Device:</strong> ${device}<br><strong>When:</strong> ${when}`) +
    p('If this was you, no action needed. <strong>If not</strong>, reply to this email and reset your password.'), SUPPORT_FOOTER))

export const emailAccountSuspended = (to) => support(to,
  'Your ReLivR account has been suspended',
  'Your ReLivR account has been suspended and you’ve been signed out. If you think this is a mistake, reply to this email.',
  layout('Account suspended',
    p('Your ReLivR account has been suspended and you’ve been signed out.') +
    p('If you think this is a mistake, reply to this email and we’ll review it.'), SUPPORT_FOOTER))

export const emailAccountReinstated = (to) => support(to,
  'Your ReLivR account is active again',
  'Good news — your ReLivR account has been reinstated. You can sign in again.',
  layout('Account reinstated',
    p('Good news — your ReLivR account has been reinstated. You can sign in again.') +
    button(FRONTEND_URL, 'Open ReLivR'), SUPPORT_FOOTER))

export const emailAccountDeleted = (to) => support(to,
  'Your ReLivR account has been deleted',
  'Your ReLivR account has been deleted and your personal data anonymised. If you didn’t do this, reply to this email immediately.',
  layout('Account deleted',
    p('Your ReLivR account has been deleted and your personal data anonymised.') +
    p('If you didn’t request this, reply to this email immediately.'), SUPPORT_FOOTER))

export const emailWelcome = (to, name) => support(to,
  'Welcome to ReLivR 🎉',
  `Hi ${name || 'there'} — your email is verified and your ReLivR account is ready. Post a task, bid on work, or browse local Campus Deals.`,
  layout(`Welcome${name ? ', ' + name : ''}!`,
    p('Your email is verified and your ReLivR account is ready to go.') +
    p('Post a task, bid on work, or browse Campus Deals from local businesses.') +
    button(FRONTEND_URL, 'Get started'), SUPPORT_FOOTER))

// ── TRANSACTIONAL (updates sender) ───────────────────────────────────────────
export const emailWaitlistConfirmation = (to) => updates(to,
  'You’re on the ReLivR waitlist',
  'Thanks for joining the ReLivR waitlist! We’ll email you the moment we launch on your campus.',
  layout('You’re on the list',
    p('Thanks for joining the ReLivR waitlist! We’ll email you the moment we launch on your campus.'), UPDATES_FOOTER))
