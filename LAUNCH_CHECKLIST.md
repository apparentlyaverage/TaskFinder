# ReLivR — Launch Checklist (relivr.co.za)

Master go-live runbook. Legend: **[YOU]** = a dashboard/account action only you can do ·
**[CODE]** = handled in the repo (✅ already done) · **[DB]** = a database action.

> **Architecture:** Frontend (React/Vite) → **Vercel** at `relivr.co.za` ·
> Backend (Express) → **Railway** at `api.relivr.co.za` · Database → **Neon** ·
> Domain/DNS → **HostAfrica** · Transactional email → **Resend** ·
> Payments → **Paystack** (can wait until ~Month 2).

---

## Phase 0 — Code readiness  ✅ (done in this repo)

- [x] **[CODE]** `frontend/vercel.json` — SPA rewrites so deep links (`/local`, `/dashboard`, `/task/:id`) don't 404 on refresh, + security headers + asset caching.
- [x] **[CODE]** CORS accepts `FRONTEND_URL` + optional `CORS_EXTRA_ORIGINS` (apex + www).
- [x] **[CODE]** Email default sender = `noreply@relivr.co.za`.
- [x] **[CODE]** Server binds `process.env.PORT` (Railway-compatible); health check at `/health`.
- [x] **[CODE]** Pre-launch gate live: app is locked to the public until **2026-07-07**, opens automatically. Admins, `business` accounts, and `@relivr.test` QA accounts get in early.

---

## Phase A — DNS at HostAfrica

In the HostAfrica control panel → DNS zone for `relivr.co.za`. **The exact target values come from each provider's dashboard (Vercel / Railway / Resend) — add the records they show. Typical values:**

| Host | Type | Value | Purpose |
|------|------|-------|---------|
| `@` (apex) | `A` | `76.76.21.21` | Frontend → Vercel |
| `www` | `CNAME` | `cname.vercel-dns.com` | www → Vercel |
| `api` | `CNAME` | *(target Railway gives you)* | Backend → Railway |

- [ ] **[YOU]** Add the apex `A` + `www` `CNAME` (Vercel).
- [ ] **[YOU]** Add the `api` `CNAME` (Railway's value).
- [ ] **[YOU]** Email records (Resend + mailboxes) — see **Phase E**.
- [ ] Note: DNS can take 5 min–24 h to propagate.

---

## Phase B — Vercel (frontend)

- [ ] **[YOU]** Connect the repo (root dir = `frontend`). Framework preset: **Vite**. Build: `npm run build`, output `dist`.
- [ ] **[YOU]** Add domain `relivr.co.za` **and** `www.relivr.co.za`; set **apex as primary** (www auto-redirects to apex).
- [ ] **[YOU]** Env var → `VITE_API_URL = https://api.relivr.co.za` (Production).
- [ ] **[YOU]** Redeploy after setting the env var (Vite bakes env at build time).

---

## Phase C — Railway (backend)

- [ ] **[YOU]** Connect the repo. Set the service **Root Directory = `server`** so Railway builds the backend (via Nixpacks or `server/Dockerfile`). `railway.json` keeps the health check at `/health`. *(A Railway auto-fix already removed the in-file build/start commands so its detection isn't overridden — leave those out.)*
- [ ] **[YOU]** Add custom domain `api.relivr.co.za` → copy the CNAME target it gives into HostAfrica (Phase A).
- [ ] **[YOU]** Set environment variables (see the matrix below). **Do NOT set `PORT`** — Railway injects it.

**Railway env vars:**
```
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require
JWT_SECRET=<64-char hex>            # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_EXPIRES_IN=7d
SESSION_SECRET=<another 64-char hex>
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALLBACK_URL=https://api.relivr.co.za/auth/google/callback
FRONTEND_URL=https://relivr.co.za
CORS_EXTRA_ORIGINS=https://www.relivr.co.za
EMAIL_FROM=ReLivR <noreply@relivr.co.za>
RESEND_API_KEY=                      # add once Resend domain is verified (Phase E)
NODE_ENV=production
# PAYSTACK_SECRET_KEY / PAYSTACK_PUBLIC_KEY  → add when payments go live (Phase F)
# SENTRY_DSN                                 → optional error tracking
```

- [ ] **[YOU]** Generate fresh `JWT_SECRET` and `SESSION_SECRET` for production (don't reuse dev values).

---

## Phase D — Google OAuth

In Google Cloud Console → APIs & Services → Credentials → your OAuth client:

- [ ] **[YOU]** Authorized JavaScript origins: `https://relivr.co.za`, `https://www.relivr.co.za`
- [ ] **[YOU]** Authorized redirect URI: `https://api.relivr.co.za/auth/google/callback`
- [ ] **[YOU]** Make sure the OAuth consent screen is **Published** (not just "Testing").

---

## Phase E — Email

Two separate jobs — keep them straight:

**1. Transactional sending (Resend)** — the app sends verify-email, password-reset, and notification mail from `noreply@relivr.co.za`.
- [ ] **[YOU]** Add `relivr.co.za` as a domain in Resend → it generates DKIM (CNAMEs), SPF (TXT), and a return-path **subdomain** MX (e.g. `send.relivr.co.za`). Add those to HostAfrica DNS.
- [ ] **[YOU]** Once Resend shows "Verified", set `RESEND_API_KEY` on Railway and redeploy.

**2. Business mailboxes (HostAfrica)** — real inboxes like `hello@relivr.co.za`, `support@relivr.co.za`.
- [ ] **[YOU]** Enable HostAfrica email hosting and create the mailbox(es); add their **apex MX** records.
- [ ] Note: Resend's records live on a **subdomain** (`send.…`), so they don't clash with the apex MX used by your HostAfrica mailboxes. Both can coexist.
- [ ] **[YOU]** Update the deck/site contact (`hello@relivr.co.za`) once the mailbox exists.

---

## Phase F — Payments (Paystack)  *(can wait until ~Month 2)*

- [ ] **[YOU]** Register the business / complete Paystack onboarding (requires a registered entity).
- [ ] **[YOU]** Set `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY` (live `sk_live_/pk_live_`) on Railway.
- [ ] **[YOU]** In Paystack → Webhooks, set the URL to `https://api.relivr.co.za/payments/webhook`.
- [ ] Until then the app boots fine; `/payments/*` simply returns an error and the UI shows "escrow coming soon".

---

## Phase G — Database (Neon)  ✅ mostly done

- [x] **[DB]** All migrations (01–31) applied to the live Neon DB.
- [ ] **[YOU]** Confirm Railway's `DATABASE_URL` points at the **production** Neon branch.
- [ ] **[YOU]** (Recommended) Remove leftover test data before public launch:
  `DELETE FROM users WHERE email LIKE '%@relivr.test';` and the `Test University` / `Campus Coffee Co` rows.
- [ ] **[YOU]** Confirm Neon Point-in-Time-Restore / backups are on (see `docs/OPS_RUNBOOK.md`).

---

## Phase H — Go-live verification (smoke test once DNS resolves)

- [ ] `https://relivr.co.za` loads over HTTPS with a valid certificate; landing renders.
- [ ] Refresh on a deep link (`https://relivr.co.za/local`) → **no 404** (confirms `vercel.json`).
- [ ] `https://api.relivr.co.za/health` → `{"status":"ok","db":"connected"}`.
- [ ] Sign up + log in (email/password) works; refresh keeps you logged in.
- [ ] "Sign in with Google" completes and lands back in the app.
- [ ] A `@relivr.test` QA account reaches the full app (gate bypass); a normal new account sees the **launch countdown**.
- [ ] Password-reset email arrives from `noreply@relivr.co.za` (needs Phase E done).

---

## Phase I — Launch day (2026-07-07)

- [ ] **[CODE]** Gate opens automatically at midnight — verify a normal account can now enter.
- [ ] **[DB]** Flip the founder default: `ALTER TABLE users ALTER COLUMN beta_founder SET DEFAULT FALSE;`
- [ ] **[YOU]** Email the launch waitlist.
- [ ] **[YOU]** Activate the campus ambassadors / referral push.
- [ ] **[YOU]** Switch Paystack to live keys when escrow is ready (Phase F).

---

## Quick reference — where each secret lives

| Variable | Railway (backend) | Vercel (frontend) |
|---|:---:|:---:|
| `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET` | ✅ | — |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | ✅ | — |
| `FRONTEND_URL`, `CORS_EXTRA_ORIGINS` | ✅ | — |
| `EMAIL_FROM`, `RESEND_API_KEY` | ✅ | — |
| `PAYSTACK_SECRET_KEY/PUBLIC_KEY` | ✅ | — |
| `VITE_API_URL` | — | ✅ |

> **Never commit real secrets.** `.env` files are gitignored; set values in the Railway/Vercel dashboards only.
