# ReLivR — Developer Onboarding

> **Read this once, then read [`DEVELOPMENT_TEAM_STATE.md`](../DEVELOPMENT_TEAM_STATE.md) at the
> start of every working session.** This document tells you what ReLivR is, how we work, and
> what "done" means here, so you can ship independently. The state doc tells you where the
> build is *right now* — it is updated after every feature and is the single source of truth
> for current status.

---

## 1. What we are building

**ReLivR** is a peer-to-peer campus services marketplace for South African university
students. **Creators** post tasks (fix my Python script, proofread my essay, laundry run);
**Earners** bid, do the work, and build a public, verified reputation. Around that core sits a
**Local** directory of campus businesses (Instagram-style profiles, student-only QR deals,
bookings), because the campus economy is bigger than student-to-student tasks.

- **Launch:** Rhodes University, Grahamstown/Makhanda — **7 July 2026** (a hard gate exists in
  code; see §9).
- **Currency:** ZAR. **Jurisdiction:** South Africa (POPIA, Consumer Protection Act).
- **Expansion model:** campus-by-campus, data-driven — campuses/zones are rows in the
  `locations` table, never hard-coded. 13 further SA campuses are pre-seeded inactive.

### Vision
Every student campus runs on its own trusted economy — where any student can turn skills into
income, buy back their time, and support campus businesses, without leaving a platform they
trust.

### Mission
Connect students who need things done with students who can do them — safely, verifiably, and
affordably — starting at Rhodes and expanding campus-by-campus across South Africa.

### Business statement
ReLivR is free during beta. The revenue model (staged, per the growth playbook):
1. **Marketplace fees** on escrowed task payments (Paystack; group G — parked until the owner
   green-lights payments).
2. **Business tools**: boosts/promoted placement (built, free during beta, billing lands with
   G1), deals, bookings, and B2B partnerships (playbook: first FMCG client ~M14).
3. **Growth targets** (playbook): user CAC < R20 by month 6; diversify beyond Rhodes in
   months 13–24 to remove single-campus risk.

> The vision/mission/business wording above was synthesised from the owner's decisions,
> landing copy, and playbook references in the migration history. Treat it as canon for build
> decisions; the owner may re-word it for external use.

### Brand
The mark is a **two-leaf sprig** (orchid + ink — the poster and the earner, one stem). Source
of truth: `frontend/public/logo.svg`, mirrored by the `LogoMark` component. The palette is
derived from it: plum interactive accent `#7e22ce`, orchid `#c084fc` decorative, ink
`#131118`, near-white lilac grounds. **All colours come from the CSS token block at the top of
`App.jsx`** — never hardcode hex values in components. Note the historical alias trap:
`--amber` IS the accent purple and `--purple` is the amber warning colour. Don't "fix" this
rename — 100+ call sites depend on it; the token block comment explains.

---

## 2. Where the build stands

**Do not trust this section over the state doc — it summarises; the state doc governs.**

### Built and live (backend 315 tests green as of 2026-07-03)
- **Marketplace core**: tasks (post/bid/accept/complete/cancel/extend, bidding deadlines,
  task TTL + archiving), price handshakes/agreements, reviews + trust scores, disputes,
  messaging + notifications (in-app, email via Gmail SMTP, Web Push), universal search,
  templates, categories (colour-coded, no-image cards).
- **Identity & onboarding**: email + Google OAuth with a unified question flow (intent /
  campus / skills), POPIA consent capture on both paths, student-email verification
  (data-driven `student_domains` allowlist), intent-tailored walkthrough, coachmarks.
- **Local / B2B (E-group)**: business profiles (IG-style), deals + recurring deals,
  student-only QR deals (claim → scan → redeem), business reviews, boosts, per-business
  feature toggles, client history, availability calendars + bookings + reminders (D-group),
  retainers + deal-expiry notifications (F-group).
- **Platform**: installable PWA + Web Push (H1), feature flags with role/%/campus targeting +
  scheduled windows (H2), god-mode admin + append-only audit log, referrals, launch gate,
  Turnstile bot-check (env-gated), CSP, profanity filter (server-side, GPLv3 word list).

### Not built / parked (needs owner sign-off first — see §11)
- **A1 ID verification** — blocked on the owner's provider choice + SA legal review.
- **G-group payments/escrow** — Paystack foundation exists (webhooks, migrations 23–31);
  actual escrow flows are parked until the owner green-lights.
- **Live-verification backlog** — D/E/F/H features are unit-tested + build-clean, but a
  consolidated visual pass on production is owed (the /auth/login rate limit blocked E2E
  in earlier sessions). Check the state doc header for the current list.

---

## 3. Your role

You are joining a **five-persona autonomous dev agency** (defined in
`DEVELOPMENT_TEAM_STATE.md` §0): Architect, Senior Engineer, QA/Security, Product Owner proxy,
and Scribe. In practice one developer wears all hats per feature. Your responsibilities:

1. **Read `DEVELOPMENT_TEAM_STATE.md` first, every session.** It is the contract between
   sessions. If you didn't update it, your work didn't happen.
2. **Deliver features end-to-end**: migration → backend route + tests → frontend → build →
   visual verification where possible → state-doc entry → commit + push to `main`.
3. **Guard the launch**: nothing you ship may break the pre-launch gate, the test suite, or
   the frontend build. CI runs the frontend suite; the backend suite is run locally
   (`npm test` in `server/`) and must be green before every push.
4. **Work the roadmap** (`docs/FEATURE_BRIEF.md`, groups A–I with locked decisions), in the
   order the owner directs. Do not invent scope; do surface follow-ups explicitly.
5. **Record everything**: every feature gets a Session Log entry (what/why/how verified/what's
   deferred) and a header update in the state doc. Commit messages follow the existing
   `feat(scope): …` style with body detail.

### Response/working format (per the operating protocol, state doc §0.1)
Team Sync (what & why) → Execution (the work) → QA/Security (tests, verification, risks) →
State Update (doc + commit). Keep that shape in PRs/handovers too.

### Autonomy boundaries — decide yourself vs. escalate
**Decide yourself:** implementation details, schema design (within conventions), UX micro-
decisions consistent with the design system, refactors that keep tests green, test coverage,
copy that makes no new claims.
**Escalate to the owner (uthando.mkwanazi@gmail.com):** anything in §11, plus: new third-party
providers, anything that costs money, anything that touches consent/PII lawful basis, public
copy that makes factual claims (see §10 — we do not fabricate social proof), deleting user
data, and changes to fees/pricing.

---

## 4. Architecture

```
frontend/  React 18 + Vite, ONE file: src/App.jsx (~7,700 lines) ──▶ Vercel
server/    ONE Express service (routers per domain)              ──▶ Railway
db/init/   NN_*.sql idempotent migrations                        ──▶ Neon Postgres 16
legacy/    retired gateway + 7 microservices (reference only)
docs/      FEATURE_BRIEF (roadmap) · EMAILS · OPS_RUNBOOK · SECURITY_RUNBOOK · this file
```

- **Monolith on purpose.** The microservices were retired pre-launch (state doc §2). Code
  stays modular via `server/routes/*.js`; split later only if scale demands.
- **Single-file frontend on purpose.** `App.jsx` holds the design tokens (injected `<style>`
  block at the top), all components, and the router. Search-navigate with grep; keep new
  components colocated near their feature. Yes it's unusual; it ships fast for one team.
  Don't split it without owner sign-off.
- **Auth:** JWT (`{userId, role, email, tv}`) + Google OAuth. `tv` = token_version; bumping it
  (logout/reset) revokes all tokens. `requireAuth` DB-checks it per request.
- **Notifications:** `server/notify.js createNotification()` → in-app row + email (per user
  `email_frequency`) + Web Push, all best-effort. Never block a transaction on a notification.
- **Scheduler:** `server/jobs.js` — interval housekeeping only. **Query-time filters are
  authoritative** (expiry, visibility, eligibility decided in the read query); jobs just tidy
  up and send reminders. This is a core principle — don't build features that depend on a job
  having run.
- **Feature flags:** `feature_flags` table; `GET /flags` resolves per-viewer (role, %-bucket,
  campus, schedule window). New surfaces ship dark behind a flag.
- **Email:** Gmail SMTP now (`GMAIL_USER`/`GMAIL_APP_PASSWORD`), Resend-ready when a domain
  exists. Two senders: Support (reply-to) and Updates (no-reply). Catalog in `docs/EMAILS.md`.

---

## 5. Local setup

```bash
git clone <repo> && cd taskfinder-platform
cp .env.example server/.env        # fill: DATABASE_URL (Neon), JWT_SECRET (≥32 chars), GOOGLE_*
cd server && npm install && npm run dev          # :3001 — validates env at boot
cd ../frontend && npm install && npm run dev     # :3000 — Vite proxies API paths to :3001
```

- **Migrations:** `cd server && npm run migrate <N>` applies `db/init/N_*.sql` **directly to
  the live Neon DB** — there is no local/staging DB by default. Migrations must be idempotent
  (`IF NOT EXISTS` everywhere). Treat `npm run migrate` with production respect.
- **Tests:** `cd server && npm test` (Vitest + Supertest, pool fully mocked — tests never
  touch the DB and never call `/auth/login`; they mint JWTs locally via `test/helpers.js`).
  Frontend: `cd frontend && npm test` (3 tests) and `npm run build` must both pass.
- **QA accounts:** reserved domain `@relivr.test` bypasses the launch gate (student01/biz01
  etc.). Credentials live in the owner's private `RELIVR_TEST_LOGINS.md` — **outside the repo;
  never commit it or any credentials.** Ask the owner for access.

### Dev gotchas that will bite you (learned the hard way)
- **Vite proxy path collisions:** paths that are both an API route AND a frontend route
  (`/deals`, `/scheduling`, `/retainers`) get intercepted by the proxy on a *browser*
  navigation in dev → always navigate client-side; prod (Vercel rewrite) is unaffected. Any
  NEW api prefix must be added to `frontend/vite.config.js` proxy allowlist.
- **Rate limits are real in dev:** `/auth/login` allows 5/15min per IP; `/auth/register` 5/hr.
  Repeated manual logins will lock you out of E2E — use locally-minted JWTs in tests and go
  easy on the login form.
- **Pre-launch gate returns 503** for non-bypass users until launch (client mirror +
  server-side in `app.js`). If "everything is broken" in dev, check whether you're gated.
- **`/auth/me` returns snake_case; `/auth/register` + `/auth/login` return camelCase.**
  Consumers must map accordingly. Don't unify without auditing every consumer.
- **Test mocks route by SQL regex** — rewording a query can break a test that greps for it.
  Run the suite after any query edit.
- **db/init is not the full live schema** (early drift: some live columns predate the repo's
  SQL). Never assume a fresh DB from `db/init` alone matches prod; check the state doc's
  drift notes before schema work.

---

## 6. Engineering conventions

- **Migrations:** next number = highest in `db/init/` + 1. Idempotent DDL; data backfills
  clearly commented. One concern per file. Applied via `npm run migrate <N>`; note it in the
  state doc ("migration N on Neon").
- **Backend routes:** one router per domain in `server/routes/`. express-validator on every
  input; 422 `{errors:[…]}` for validation, `{message}` for everything else; parameterised SQL
  only; `requireAuth`/`requireAdmin` middleware; audit admin mutations via `writeAudit`.
- **Tests:** every new endpoint gets happy-path + auth + validation cases minimum. Use
  `mockDb(pool, handler)` / `mockClient` from `test/helpers.js`. Keep the suite green and
  record the new total in the state doc ("backend N green (+x)").
- **Frontend:** inline styles + CSS variables from the token block; reuse `Btn`, `Input`,
  `Mono`, `Divider`, `DCard`, `EmptyState`, `LogoMark/LogoLoader`; match the existing comment
  density and idiom. Accessibility: label every input, `aria-label` dialogs, never colour as
  the only signal, respect `prefers-reduced-motion`.
- **Do-not-break test contracts:** `landing.test.jsx` pins the auth dialog name
  (/create your account|sign in/i), `aria-modal`, the `Email`/`Password` labels, hero copy
  ("stress less", "Post a Task Free"), and /with Google/i. Change those strings only with the
  tests.
- **Commits:** small, scoped, `feat|fix(scope): summary` + explanatory body; push to `main`
  after the suite + build are green. On Windows/PowerShell, write commit messages to a temp
  file and use `git commit -F <file>` (inline quoting mangles punctuation).
- **Verification:** prefer *proof* — run the thing, screenshot it, measure it. If live
  verification is blocked (rate limit, no admin login), say so explicitly in the state doc and
  add it to the verification backlog rather than claiming it works.

---

## 7. Deployment & environments

| Piece    | Where   | How it deploys | Key env |
|----------|---------|----------------|---------|
| Frontend | Vercel  | push to `main` | `VITE_API_URL`, `VITE_TURNSTILE_SITE_KEY` |
| Backend  | Railway | push to `main` | `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_*`, `FRONTEND_URL`, `GMAIL_*`, `CLOUDINARY_*`, `VAPID_*`, `TURNSTILE_SECRET`, `SENTRY_DSN` |
| DB       | Neon    | `npm run migrate <N>` (manual) | — |

- Every provider is **optional-by-design**: missing keys = silent no-op (email → stub, push →
  no-op, Turnstile → pass-through, uploads → disabled). Follow this pattern for any new
  integration so the app never crashes on a missing key.
- Secrets live only in Railway/Vercel env and `server/.env` (gitignored). Rotation steps:
  `docs/SECURITY_RUNBOOK.md`. Backups/restore + admin promotion: `docs/OPS_RUNBOOK.md`.
- `vercel.json` carries the CSP — if you add an external origin (script/frame/connect), update
  it deliberately and note why.

---

## 8. Security & compliance (non-negotiable)

- **POPIA first.** Any new personal data needs: lawful basis, explicit consent capture
  (see `popia_consent*` columns + `/auth/consent`/`/auth/onboarding` patterns), minimisation,
  a retention answer, and a policy-page update. Consent writes are audited append-only.
- **Users can always**: export their data, delete their account (anonymising erasure), and
  control email frequency. Never break these paths.
- **Never commit**: secrets, `server/.env`, QA credentials, or the owner's private files. The
  Gmail app password and VAPID keys have already had to be treated as exposed once — assume
  anything pasted into a chat/log is burned and rotate.
- **Server-side enforcement always**: the client gate, flags, and validation are mirrors;
  the API is the boundary (see the launch gate, profanity filter, per-business feature
  toggles for the pattern).
- **Licence note:** the profanity list is GPLv3 (`better-profane-words`) — fine for our
  server-side use; don't redistribute it in client bundles.
- **Sending real communications** (email/push) from dev: don't, unless testing against your
  own address. Waitlist/feedback are live production tables.

---

## 9. The launch gate (until 7 July 2026)

Non-bypass users get a **503 + Founding Member holding page** until launch. Bypass = `admin`
or `business` role, or `@relivr.test` email. The gate is enforced in `server/app.js` (with a
whitelist of pre-launch-open paths: `/auth`, `/health`, `/flags`, `/feedback`, `/waitlist`,
`/locations`, `/categories`) and mirrored client-side (`isAppLocked`). If you add an endpoint
that must work pre-launch (auth/onboarding-adjacent), mount it under an open prefix or extend
the whitelist consciously — and test both sides of the gate.

---

## 10. Product principles

1. **Trust is the product.** Verified students, public track records, honest copy. We ripped
   out fabricated testimonials and fake "live" data pre-launch — never reintroduce invented
   social proof, fake counts, or claims the product can't back (CPA liability + brand).
2. **Query-time truth.** State transitions belong in reads, not cron jobs (§4).
3. **Ship dark, roll out targeted.** New surfaces behind flags; Rhodes first, then campuses.
4. **Free during beta, priced later.** Don't build billing assumptions into features; leave
   the hook (as boosts do: free now, billing at G1).
5. **Mobile-first, installable.** The PWA is the app; design for touch, offline shell, push.
6. **Accessibility is not optional.** AA contrast (the palette was chosen for it), labels,
   keyboard paths, reduced-motion.

---

## 11. Needs owner sign-off (do not proceed alone)

| Topic | Why | Status |
|---|---|---|
| A1 ID verification | provider choice + SA legal review of ID handling | blocked, build flag-off scaffold only when asked |
| G-group payments/escrow | money movement, Paystack go-live, fees | parked by owner |
| Legal/policy pages | SA privacy attorney review pending | owner to-do |
| New paid providers / anything billable | budget | ask first |
| Public claims in copy | CPA compliance | ask first |
| Railway/Vercel env changes | owner holds the accounts | list what to set, owner applies |

Standing owner to-dos (nag politely): set `VAPID_*` + `TURNSTILE_SECRET`/site key in prod,
Cloudinary keys, rotate the once-shared Gmail app password, attorney review, and the
consolidated post-rate-limit visual pass.

---

## 12. Definition of Done (per feature)

- [ ] Migration written (idempotent), applied to Neon, noted in state doc
- [ ] Backend: validated route(s) + tests (happy/auth/validation) — suite green, new total recorded
- [ ] Frontend: wired UI consistent with tokens/components; `npm run build` clean; 3 frontend tests green
- [ ] Flags: new surface behind a flag if it's user-visible and non-trivial
- [ ] POPIA/security pass: new data justified, validated, rate-limited if public
- [ ] Verified: live proof (screenshot/measurement) or an explicit entry in the verification backlog
- [ ] `DEVELOPMENT_TEAM_STATE.md`: header + Session Log entry
- [ ] Committed (`feat(scope): …`) and pushed to `main`; deploys verified not to 500

---

## 13. Reading order for your first day

1. This document.
2. [`DEVELOPMENT_TEAM_STATE.md`](../DEVELOPMENT_TEAM_STATE.md) — header, §0–§2, then skim the
   Session Log backwards (it's the project's memory).
3. [`docs/FEATURE_BRIEF.md`](./FEATURE_BRIEF.md) — the roadmap and its locked decisions.
4. `server/app.js` top-to-bottom (the gate, limits, routers) and one router end-to-end
   (`server/routes/deals.js` is a good exemplar: validation, flags, notify, tests).
5. `frontend/src/App.jsx` lines 1–300 (tokens + primitives), then one feature's components.
6. `docs/OPS_RUNBOOK.md` + `docs/SECURITY_RUNBOOK.md` — know where the fire extinguishers are.

Welcome aboard. Update the state doc, keep the suite green, and ship. 🌱
