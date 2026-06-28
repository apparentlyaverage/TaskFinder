# ReLivR — Email Plan & Catalog

The complete map of transactional email. Sending lives in `server/email.js`
(provider) + `server/emails.js` (the typed catalog of templates). Activity mail
is delivered through `server/notify.js` (`createNotification`).

## Senders (two categories)
| Sender | Env | Used for | Reply-to |
|---|---|---|---|
| **Support** | `EMAIL_FROM_SUPPORT` | security & account mail | `SUPPORT_REPLY_TO` (a real, monitored inbox) |
| **Updates** | `EMAIL_FROM_UPDATES` | activity & transactional notices | none (no-reply) |

Provider precedence (runtime): **Gmail SMTP** (`GMAIL_USER` + `GMAIL_APP_PASSWORD`)
→ **Resend** (`RESEND_API_KEY`, once a domain is verified) → **stub** (logs only).
With Gmail, the From address is forced to `GMAIL_USER`; the category **display
name** is preserved.

## Catalog — live now
| Email | Sender | Trigger | Code |
|---|---|---|---|
| Verify email | Support | `POST /auth/register` | `emails.emailVerify` |
| Password reset | Support | `POST /auth/forgot-password` | `emails.emailPasswordReset` |
| Password changed | Support | `POST /auth/reset-password`, `PATCH /profile/password` | `emails.emailPasswordChanged` |
| New sign-in alert | Support | `POST /auth/login` from a new device (sha256 UA vs `known_logins`; skips first-ever sign-in) | `emails.emailNewLogin` |
| Welcome | Support | `POST /auth/verify-email` (on success) | `emails.emailWelcome` |
| Account suspended | Support | `PATCH /admin/users/:id` (suspend) | `emails.emailAccountSuspended` |
| Account reinstated | Support | `PATCH /admin/users/:id` (unsuspend) | `emails.emailAccountReinstated` |
| Account deleted | Support | `DELETE /profile/account`, `DELETE /admin/users/:id` | `emails.emailAccountDeleted` |
| Waitlist confirmation | Updates | `POST /waitlist` | `emails.emailWaitlistConfirmation` |
| **Activity** — new bid, bid accepted/awarded, work submitted, changes requested, task cancelled, new message, new review, dispute raised/updated/resolved, new follower, deal redeemed | Updates | `notify.createNotification` (in-app + email for `instant` users) | `notify.js` |
| Daily digest | Updates | `jobs.sendDigests` (scheduler, `daily` users) | `jobs.js` |

## Planned / future (documented, not yet wired)
| Email | Sender | Needs |
|---|---|---|
| Task deadline reminder ("your task closes in 24h") | Updates | a scheduled scan in `jobs.js` over open tasks near `deadline` |
| Weekly business summary (views/clicks/redemptions) | Updates | a weekly scheduler job over `business_page_events` + `deal_redemptions` |
| Payment receipt / payout / escrow events | Support/Updates | MVP-3 payments (parked on company registration) |
| Re-engagement ("you have N unread / new tasks near you") | Updates | inactivity tracking + opt-out handling |
| Email-change confirmation (old + new address) | Support | a change-email feature (none today) |

## Conventions
- Every catalog email has a plain-text **and** branded HTML body (inline styles, email-client safe).
- Activity mail respects the user's `email_frequency` (`instant` / `daily` / `off`); security mail always sends.
- All sends are **best-effort** — a mail failure never blocks the underlying action.
