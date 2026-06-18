# Relivr — Architectural State

> Persistent state file for the autonomous development agency.
> **Read this first at the start of every session.**
> Last updated: 2026-06-15 — *Session 0: Project induction & baseline audit.*

---

## 0. The Team (Personas)

| Persona | Mandate |
|---|---|
| **Lead Architect** | Microservice integrity, API design, system scalability. |
| **Lead Developer** | Clean modular code, DB schemas, business logic. |
| **QA & Security Engineer** | Testing, OWASP Top 10, secure data handling. |
| **Product Manager** | Backlog prioritisation by user value, roadmap coherence. |

**Workflow loop for every task:** Analyze & Plan (all 4 personas) → Implement → Self-Correction (QA/Security critique) → Document outcome here.

---

## 1. Product Snapshot

**ReLivR** (canonical brand, ratified 2026-06-15) is a **peer-to-peer service marketplace**. Creators post tasks; Earners bid and fulfil them. Localised to South Africa (POPIA consent, SA phone normalisation, ZAR).

**Go-to-market:** launch at **Rhodes University** → expand campus-by-campus → eventually all of South Africa. **Architectural rule that follows from this:** never bake Rhodes-only assumptions into the data model. Location is a **generalised, optional, hierarchical** taxonomy (campus → region → national), used for scoping/filtering — *never* as a gate on who can join.

**Trust mechanism (decided 2026-06-15):** a standard **5-star rating/review system**, not affiliation tags. Ratings are campus-agnostic, so they scale unchanged from one campus to the whole country. The earlier "affiliation trust tag" idea is **dropped** — tying trust to a verifiable campus would cap the addressable audience, which contradicts the national goal.

- **Frontend:** React 18 + Vite (`frontend/`) → Vercel
- **Backend:** **Consolidated Express monolith** (`server/`) → Railway. Modular via routers.
- **DB:** PostgreSQL 16 (Neon), 13 tables, schema in `db/init/01..06_*.sql`
- **Auth:** Local (bcrypt) + Google OAuth, JWT-based (stateless)

---

## 2. Architecture Reality vs. Intent — ⚠️ Critical Drift

The project has **two parallel backends** and they disagree:

| Layer | `server/` (LIVE) | `services/` + `gateway/` (LEGACY) |
|---|---|---|
| Shape | Single Express app, routers | 7 microservices + API gateway |
| Auth | JWT verified in `middleware.js` | Trusted spoofable `x-user-id` header |
| Messaging | Direct `createNotification()` | RabbitMQ |
| Status | **Actively developed** (all recent commits) | **Abandoned but still wired into `docker-compose.yml`** |

**`docker-compose.yml` still builds and runs the legacy microservices, not `server/`.** Anyone running `docker compose up` deploys dead, insecure code. This is the single most dangerous inconsistency in the repo.

**✅ RATIFIED (2026-06-15):** The **`server/` monolith is the official backend.** The `services/` microservices + `gateway/` are **retired** — to be archived/deleted and removed from `docker-compose.yml` in Sprint 1 (MVP-1). No further work lands in `services/`.

---

## 3. Current Capabilities (what works today)

- **Auth:** register, login, Google OAuth (3-branch: returning / email-link / new), `/auth/me`, POPIA consent flow with versioning + IP + audit log, logout (client-side token drop).
- **Tasks:** create, browse (public), bid, complete (status flip).
- **Profiles, Businesses, Messages/Notifications, Reviews** routers present.
- **Security baseline (good):** `helmet`, exact-origin CORS w/ credentials, `trust proxy`, layered rate limits (login 5/15m, register 5/h, global 120/min), bcrypt cost 12, JWT-verified middleware (no header trust), `express-validator` on inputs, append-only `activity_logs`, constrained campus-zone enum, request body cap 100kb.

---

## 4. Technical Debt Register

| # | Severity | Item | Owner |
|---|---|---|---|
| TD-1 | ✅ RESOLVED | ~~`docker-compose.yml` deploys legacy `services/`, not `server/`.~~ Compose rewritten to build the `server/` monolith (+ new `server/Dockerfile`). `railway.json` was already correct. *(MVP-1)* | Architect |
| TD-2 | ✅ RESOLVED | ~~Zero automated tests.~~ Vitest + Supertest harness with **17 passing tests** (auth, validation, JWT, rate-limit, headers) + GitHub Actions CI. *Note:* frontend still untested → new TD-10. *(MVP-1)* | QA |
| TD-3 | 🔴 Critical | **Payments mismatch.** Mandate = Paystack/Ozow + ZAR. Schema/code = **Stripe + USD** (`escrow_transactions.currency DEFAULT 'usd'`, `stripe_payment_intent_id`, `stripe_accounts`). Escrow is fully **deferred** — task completion is just a status flip, no money moves. → **MVP-3** | Architect + Dev |
| TD-4 | ✅ RESOLVED | ~~Legacy `services/` + `gateway/` dead weight + `x-user-id` trust trap.~~ Archived to `legacy/` with a retirement README; out of all build/deploy configs. *(MVP-1)* | Architect |
| TD-5 | ✅ RESOLVED | ~~JWT no revocation.~~ `token_version` (migration 08) embedded in every JWT, checked in `requireAuth` + `/auth/me`; **logout now revokes** (bump), password change kills all sessions. Verified live: post-logout `/auth/me` → 401. Tradeoff: 1 indexed lookup/authed request. *(Debt sprint)* | Security |
| TD-6 | ✅ RESOLVED | ~~Docs drift.~~ README rewritten: brand **ReLivR**, Paystack/ZAR, monolith backend, correct repo (`apparentlyaverage/TaskFinder`), `npm run migrate`/test steps. *(Debt sprint)* | PM |
| TD-7 | ✅ RESOLVED | ~~No logging strategy.~~ `server/log.js` (structured JSON) + `X-Request-Id` middleware; **every** `console.error` across the server converted to `log.*` with `reqId`. *(Debt sprint)* | Architect |
| TD-8 | ✅ RESOLVED | ~~No env validation.~~ `server/env.js` `assertEnv()` fails fast at boot (JWT_SECRET ≥32, DATABASE_URL, GOOGLE_*) with a clear message. Tested. *(Debt sprint)* | Security |
| TD-9 | 🟢 Low | Uncommitted working changes on `main` — now spans MVP-1/2, mobile, and this debt sprint. Should be branched + committed (awaiting owner's go). | Dev |
| TD-10 | ✅ RESOLVED | ~~Frontend untested.~~ Vitest + React Testing Library + jsdom; smoke test renders the app; wired into CI (`frontend` job runs `npm test`). *(Debt sprint)* | QA |
| TD-11 | ✅ RESOLVED | ~~Hard-coded campus list.~~ `useLocations()` fetches `GET /locations` (verified firing) with the constant as offline fallback. *(Debt sprint)* | Dev |
| TD-12 | ✅ RESOLVED | ~~Migration unrun.~~ `server/scripts/migrate.mjs` (`npm run migrate`) **applied 07+08 to the live Neon DB**; `location_id` now written on register + profile update. *(Debt sprint)* | Dev + QA |

---

## 5. Roadmap — Next 3 Critical Features for MVP

Prioritised by the Product Manager (user value × unblocking power), vetted by Architect/Security. **All four §6 questions are now resolved (see below); roadmap updated to reflect multi-campus + Paystack/Ozow + ReLivR.**

### 🥇 MVP-1 — Test & CI Foundation + Monolith Cutover
*Why first:* Mandate forbids shipping features without tests, and the deploy path is currently broken (TD-1). No feature is safe to build until we can verify it and actually ship it. This is the platform for everything else.
- Stand up a test runner (Vitest or `node:test`) + Supertest for the `server/` API.
- Seed tests for the existing auth surface (register/login/JWT/consent) and rate limits.
- **Cut over `docker-compose.yml` to run the `server/` monolith; archive/delete `services/` + `gateway/`** (decision ratified).
- Add a minimal CI workflow (lint + test on push).
- *Resolves:* TD-1, TD-2, TD-4.

### 🥈 MVP-2 — Trust: 5-Star Ratings + Scalable Location Model — ✅ DELIVERED (2026-06-15)
*Why second:* Trust is the backbone of a P2P marketplace between strangers, and it must exist before money moves (MVP-3). Ratings are the chosen trust primitive — universal and campus-agnostic, so they carry us from Rhodes to national with zero rework. We also remove the one true audience-limiter (the Rhodes-only `CAMPUS_ZONES` enum) in the same sprint, while there's no data to migrate.

**Part A — Reviews & Ratings (the trust layer):**
- Wire the existing `reviews` table + `user_profiles.avg_rating` into working endpoints (the columns/tables already exist).
- A review can only be left **after a task is completed**, **one per task per side**, **no self-review**, rating constrained to 1–5 (DB CHECK + API validation).
- Recompute and surface `avg_rating` + review count on profiles, task cards, and bids.
- *Resolves:* pulls Reviews forward from the Sprint-4 backlog; gives MVP-3 a trust gate to lean on.

**Part B — Scalable location model (the audience guardrail):**
- Replace the hard-coded Rhodes `CAMPUS_ZONES` enum with a lightweight **hierarchical reference** (e.g. `campus`/`region` → optional `zone`), seeded with Rhodes for launch but open-ended.
- Location is **optional and non-gating** — supports a future non-student user in a SA town who belongs to no campus.
- Browse/filter tasks by location; default the UI to Rhodes at launch without locking the schema to it.
- *Resolves:* generalises all Rhodes-only assumptions (the real expansion blocker).

### 🥉 MVP-3 — Localised Payments & Escrow (Paystack → Ozow, ZAR)
*Why third:* A services marketplace with no money movement is a demo, not a product — but it must sit on verified identity (MVP-2) so money only flows between trustable parties.
- Re-platform the payment layer from Stripe/USD to **Paystack** and **ZAR** (`amount_cents` in cents, currency `zar`). Rename `stripe_*` schema/columns.
- **Paystack is primary; Ozow is added *through Paystack* once approved and tested** (not a separate rail — keeps the integration surface single).
- Escrow lifecycle: fund on award → hold → release on creator confirmation → refund/dispute path.
- Webhook signature verification (Paystack), idempotency keys, reconciliation.
- *Resolves:* TD-3. Hardens with TD-5/TD-7 patterns.

> **Deferred to Sprint 4 (post-MVP-3):** Disputes endpoints (reviews now land in MVP-2), token refresh/revocation (TD-5), fail-fast env validation (TD-8), structured logging + request IDs (TD-7). Tracked so they aren't lost.

---

## 6. Product Owner Decisions — ✅ RESOLVED 2026-06-15

1. **Payments:** **Paystack primary.** Ozow added **through Paystack** once approved and tested — single integration surface, not a parallel rail.
2. **Microservices:** **Retire `services/` + `gateway/`.** The `server/` monolith is the official backend.
3. **Brand:** Canonical name is **ReLivR** (update README, repo, UI copy to match).
4. **Launch scope:** Launch **at Rhodes**, then expand campus-by-campus, then nationally. Build so nothing in the data model limits that audience.

5. **Trust mechanism (revised 2026-06-15):** standard **5-star ratings/reviews**, **not** affiliation tags. *Rationale:* ratings are campus-agnostic and scale unchanged to a national audience; affiliation-as-trust would cap the addressable market at users with a verifiable campus. Affiliation is dropped; the Rhodes-only `CAMPUS_ZONES` enum is generalised into an optional, non-gating location taxonomy (now MVP-2 Part B). *(Owner delegated the call; decided by the architecture team.)*

---

## 6.5 — Sprint 1 (MVP-1) — ✅ COMPLETE (2026-06-15)

**Goal:** make the platform verifiable (tests) and shippable (correct deploy path). No product features — pure foundation.

**Four-persona analysis:**
- **Architect:** Extract the Express app from `index.js` into `app.js` (exported, no `listen()`) so it's testable in-process via Supertest; `index.js` becomes the thin listen entrypoint. Monolith uses **Postgres only** — Redis/RabbitMQ/gateway/7 microservices all leave `docker-compose.yml`. New `server/Dockerfile` (none exists today).
- **Lead Dev:** Test runner = **Vitest + Supertest** (clean ESM module mocking for the `pg` pool; Node 24 native ESM). Tests split by isolation: (a) no-DB tests — health, 404, security headers, input-validation 422s, `requireAuth` 401s, login rate-limit 429; (b) DB-mocked tests — login success/invalid, `/auth/me`, register duplicate/success.
- **QA & Security:** Rate-limit state is per-file in Vitest (fresh module registry) → keep the 429 test in its own file so it can't starve others. Assert security headers (`helmet`) and that protected routes reject missing/garbage JWTs. Tests must set dummy `JWT_SECRET` + `GOOGLE_*` env (the Google strategy is constructed at import time and throws if absent).
- **PM:** Definition of done = `npm test` green in `server/`, `docker compose config` valid against the monolith, legacy code archived (not deleted — reversible), CI runs tests on push.

**Tasks:**
1. Refactor `index.js` → `app.js` (export app) + thin `index.js`.
2. `server/package.json`: add `vitest` + `supertest`; `test` / `test:run` scripts.
3. Test suite under `server/test/` (setup env + 3–4 spec files).
4. Rewrite `docker-compose.yml` → postgres + server only; add `server/Dockerfile` + `.dockerignore`.
5. Archive `services/` + `gateway/` → `legacy/` with a retirement README.
6. `.github/workflows/ci.yml` — install + test on push/PR.
7. Self-correction (QA/Security pass) → update debt register + session log.

**Outcome / what shipped:**
- `server/app.js` (exported app) + thin `server/index.js` entrypoint.
- `server/test/` — `setup.js` + 3 spec files, **17 tests passing** via `npm test` (Vitest + Supertest).
- `server/Dockerfile` + `.dockerignore`; `docker-compose.yml` rewritten → **postgres + server only** (Redis/RabbitMQ/gateway/7 services removed). `docker compose config` parses clean.
- Legacy backends archived → `legacy/services`, `legacy/gateway` + `legacy/README.md` (retirement notice).
- `.github/workflows/ci.yml` — server tests + frontend build on push/PR to `main`.
- **Self-correction findings:** (a) `railway.json` already pointed at `server/` — prod deploy was never broken, only the Docker path was; documented. (b) Frontend has no tests → logged as **TD-10**. (c) Changes are unstaged — not committed (awaiting owner's go).

---

## 6.6 — Sprint 2 (MVP-2) — ✅ COMPLETE (2026-06-15)

**Goal:** Trust layer (5-star ratings) + remove the Rhodes-only audience limiter, both fully tested.

**Discovery that reshaped the sprint:** the reviews/ratings backend in `server/routes/reviews.js` is **already implemented and correct** — two-sided roles, completion gate, participant guard, unique-per-task constraint, `avg_rating`+`rating_count` recompute, notification. `rating_count` column exists. So Part A is *harden + test*, not *build*.

**Four-persona analysis:**
- **PM:** Trust ships by making the existing reviews feature trustworthy (tested) and visible. The expansion enabler is making location **data-driven** so a new campus is an INSERT, not a redeploy.
- **Architect:** Add a `locations` reference table (campus→zone hierarchy), seeded with Rhodes, + a public `GET /locations` so the picker is server-driven. Backend keeps accepting `campus_zone` (text, optional, non-gating) for back-compat; validation moves from a hard-coded Rhodes array (duplicated in `auth.js` + `profile.js`) to a shared **DB-driven** helper. Full normalization (a `location_id` FK everywhere) is deferred — text + reference table is enough for launch and non-destructive.
- **QA/Security:** Reviews need abuse limits — cap `comment` length, explicit self-review guard. Location validation must **fail-open** (a non-critical field must never block registration if the lookup errors). Cover register/profile so generalising validation doesn't regress the critical auth path.
- **Lead Dev:** Migration `07_locations_schema.sql` must be **idempotent** (`IF NOT EXISTS`) — there's no migration runner, existing DBs run it by hand.

**Tasks:**
1. Harden `reviews.js` — comment length cap + self-review guard.
2. `db/init/07_locations_schema.sql` — idempotent `locations` table + Rhodes seed + nullable `user_profiles.location_id`.
3. `server/routes/locations.js` (`GET /locations`) + mount in `app.js`.
4. Shared DB-driven, fail-open location validation helper; replace hard-coded `CAMPUS_ZONES` in `auth.js` + `profile.js`.
5. Tests: `reviews.test.js` + `locations.test.js` (+ extend auth where validation changed).
6. Self-correction (QA/Security) → debt register + session log.

**Tracked follow-up (not this sprint):** frontend `App.jsx` should fetch `GET /locations` instead of its hard-coded `CAMPUS_ZONE_LIST` → **TD-11**.

**Outcome / what shipped:**
- **Reviews hardened:** `comment` capped at 2000 chars; explicit self-review guard (creator==assignee → 400).
- **Location model:** `db/init/07_locations_schema.sql` (idempotent `locations` table + Rhodes seed + nullable `user_profiles.location_id`); public `GET /locations` route (nested campuses→zones, `?kind=` filter) mounted in `app.js`.
- **Validation generalised:** hard-coded Rhodes `CAMPUS_ZONES` arrays removed from `auth.js` + `profile.js`; replaced by shared DB-driven, **fail-open** `validateLocationName` (`server/locationValidate.js`). Adding a campus is now an INSERT, not a redeploy.
- **Tests: 32 passing** (was 17) — new `reviews.test.js` (8) + `locations.test.js` (3) + 3 location-validation cases in `auth.test.js`. Zero regressions.
- **Self-correction findings:** (a) **bug caught by tests** — express-validator async `.custom()` only fails on *throw*, so a resolved `false` silently passed; fixed by throwing in `validateLocationName` (the *old* `validCampusZone` had the same latent weakness for any async use). (b) **`07_locations_schema.sql` is statically reviewed but NOT executed** — no Postgres available in this env (docker daemon down, no psql). Must be run against a dev DB before relying on it → flagged in TD-12. (c) `location_id` FK exists but isn't yet populated/read — intentional (text `campus_zone` still the display field); full normalization deferred → TD-12.

---

## 6.7 — Debt Paydown Sprint (TD-5..12) — ✅ COMPLETE (2026-06-15)

**Goal:** clear the 1 orange + 6 yellow debt items.

- **TD-8** env validation → `server/env.js`, fail-fast in `index.js`.
- **TD-7** logging → `server/log.js` (structured JSON) + request-ID middleware + convert `console.error`.
- **TD-5** JWT revocation → `token_version` column (migration 08); included in JWT; checked in `requireAuth`/`/auth/me`; bumped on logout (revoke-all) + password change. Tradeoff: one indexed lookup per authed request (accepted for MVP scale; real logout + password-kill is worth it). Old tokens treated as `tv=0` for continuity.
- **TD-12** migration runner → `server/scripts/migrate.mjs` (no psql needed) + apply 07/08 to the dev DB; normalize `location_id` on register/profile write.
- **TD-11** frontend → `useLocations()` fetches `GET /locations` (fallback to constant) for the signup picker.
- **TD-10** frontend tests → Vitest + RTL + jsdom smoke test, wired into CI.
- **TD-6** docs → README brand/payments/repo corrected.

**Outcome:** all 7 items resolved. **Backend 37 tests** (was 32: +4 env, +1 revocation), **frontend 1 smoke test**, both green and in CI. Migrations 07+08 applied to the live Neon DB; `GET /locations` now serves Rhodes+17 zones. JWT revocation verified end-to-end (post-logout `/auth/me` → 401). **Self-correction caught a real bug:** logout bumping `token_version` would have locked out users signing back in via **Google** (that path issued `tv:0` without reading the current version) — fixed by fetching `token_version` in the OAuth callback before signing. Only TD-3 (Critical, Paystack → MVP-3) and TD-9 (Low, commit) remain open.

---

## 6.8 — Sprint: §7.1 Near-term Hardening — ✅ COMPLETE (2026-06-15)

Building all four near-term P1 items, each with tests.

1. **Task-expiry job 🐞** — `server/jobs.js` `expireDueTasks()` (`status='open' AND deadline<NOW()` → `expired`); in-process interval started from `index.js` (not `app.js`, so tests don't spawn timers) + an admin-only `POST /tasks/admin/expire` trigger for cron/ops.
2. **Disputes backend** — `server/routes/disputes.js`: `POST /disputes` (participant raises, one per task), `GET /disputes` (mine, or all for admin), `GET /disputes/:id` (+events, authz), `PATCH /disputes/:id` (admin status/notes/resolution; settlement stubbed 💳). Writes `dispute_events`; notifies parties.
3. **Password reset + email verification ✉️** — migration `09_auth_tokens.sql` (`auth_tokens`: hashed token, purpose, expiry, used_at); `server/email.js` (logs the link in dev until a provider is set); `POST /auth/forgot-password`, `POST /auth/reset-password` (bumps `token_version`), `POST /auth/verify-email`. Tokens stored **hashed**; responses don't leak whether an email exists.
4. **Core marketplace tests** — `tasks.test.js` (create/bid/accept/withdraw/complete + authz), `messages.test.js` (send/threads/notifications), closing the biggest mandate gap.

**Outcome:** all four shipped. **Backend 71 tests** (was 37) across 11 files, all green. New: `server/jobs.js` (+ scheduler in `index.js`, `POST /tasks/admin/expire`), `server/routes/disputes.js` (mounted), `server/email.js` (provider-pluggable stub), migration `09_auth_tokens.sql` (applied live), and `/auth/forgot-password` · `/reset-password` · `/verify-email`. Reset tokens stored **hashed**; forgot-password is enumeration-safe (generic 200) + rate-limited. Verified live: generic 200 on known/unknown email, 400 on bad token, authed `/disputes` → 200. **Self-correction:** resolved disputes leave the task in `disputed` (no auto-restore) — acceptable for MVP, noted. Settlement (refund/release) recorded only — executes with escrow (TD-3/MVP-3).

---

## 6.9 — Sprint: §7.2 Auth & Security (bounded) — ✅ COMPLETE (2026-06-15)

Owner chose the bounded set (defer refresh tokens + 2FA).

1. **Secret-rotation runbook** (P1) — `docs/SECURITY_RUNBOOK.md`: how to rotate JWT_SECRET (token_version absorbs the churn), DB creds, Google OAuth secret, with blast-radius notes.
2. **Per-account login lockout** (P2) — migration 10 (`failed_login_attempts`, `locked_until`, `deleted_at` on users). Login: lock after 5 fails with progressive backoff (15m→…→24h cap), 423 while locked, reset on success. Complements the existing per-IP rate limit.
3. **Account deletion + data export** (P2, POPIA) — `DELETE /profile/account` (password-confirmed for local; anonymises PII, sets `deleted_at`, bumps token_version) + `GET /profile/export` (JSON of profile/tasks/bids/reviews/messages). Login rejects `deleted_at`.
4. **Log out all devices** (P3) — `POST /auth/logout-all` (bump token_version) + Security-tab button. (Regular logout already revokes globally; this is the discoverable control.)

UI: wire export / sign-out-all / delete into the existing Profile → Security tab. Tests for lockout, logout-all, delete (authz + password), export.

**Outcome:** all four shipped. Migration 10 applied live. New: per-account lockout (5 fails → progressive 15m→24h, 423), `POST /auth/logout-all`, `DELETE /profile/account` (anonymise + `deleted_at` + token_version bump; password-gated for local), `GET /profile/export`, and `docs/SECURITY_RUNBOOK.md`. **Backend 84 tests** (+10). Profile→Security tab wired with Download-my-data / Sign-out-all-devices / Delete-account (password-confirm). Verified live: export → 200 with real data through the proxy; delete-confirm UI correct (cancelled, account preserved). **Deferred (own efforts):** refresh tokens, 2FA — remain in §7.2 list below.

---

## 6.10 — Sprint: §7.4 Transactional Email (noreply) — ✅ COMPLETE (2026-06-15)

Owner: set up §7.4's P1 (transactional email), all mail **from a noreply sender** for now. Real-time WebSocket + PWA push stay deferred (larger).

1. **noreply sender + provider** — `server/email.js`: `EMAIL_FROM` env (default `ReLivR <noreply@relivr.app>`). Sends via **Resend** when `RESEND_API_KEY` is set, else logs the dev stub (so it's ready the moment a key is added). Existing reset/verify mail picks up the sender automatically.
2. **Activity emails on every notification** — `createNotification()` also emails the recipient (best-effort, never blocks the insert), so bids/awards/reviews/disputes/messages all notify by email. Security mail (reset/verify) always sends; **activity mail respects an opt-out**.
3. **Email opt-out** — migration 11 (`users.email_opt_out`), a Profile→Security toggle, surfaced in `/profile` + `/auth/me`. POPIA/anti-spam friendly.
4. **New-message notifications** — messages now create an in-app notification (they didn't), which also emails — closing a real gap.
5. `.env.example` documents `EMAIL_FROM` + `RESEND_API_KEY`. Tests for sender/stub, opt-out gating, profile toggle.

**Outcome:** all shipped. `email.js` sends from **`ReLivR <noreply@relivr.app>`** (env-overridable) via Resend when `RESEND_API_KEY` is set, else logs the stub. `createNotification()` now also emails the recipient (opt-out aware, fire-and-forget) — so bids/awards/reviews/disputes/**messages** all notify by email; security mail (reset/verify) always sends. Migration 11 (`email_opt_out`) applied live; Profile→Security has an "Email me about activity" toggle. **Backend 90 tests** (+6). Verified live: opt-out PATCH/GET round-trips; a new message creates a `message.received` notification + email attempt. **To go live:** verify a domain with Resend and set `RESEND_API_KEY` + `EMAIL_FROM`. **Deferred:** real-time WebSocket messaging (P2), PWA push (P3), email digest (P3 — would batch the per-message emails).

---

## 6.11 — Sprint: Email push + digest, retire WebSocket — ✅ COMPLETE (2026-06-15)

1. **🔖 Bookmark WebSocket real-time** — delete the unused `contexts/SocketContext.jsx` stub (defined, never mounted) and fix the stale "Socket.io real-time" help copy. Real-time stays in §7.4 as a future item.
2. **Push via email + digest = a frequency preference** — migration 12 replaces the boolean `email_opt_out` with `email_frequency` ('instant' | 'daily' | 'off') + `last_digest_at`. 'instant' = per-event push email (current behaviour); 'daily' = no per-event mail, a scheduled **digest** batches new notifications; 'off' = none.
3. **Digest job** — `jobs.js` `sendDigests()`: for 'daily' users with new notifications since their last digest (≥20h gate → daily cadence), email a summary and stamp `last_digest_at`. Added to the scheduler (hourly tick, gated).
4. UI: Profile→Security email control becomes a 3-way selector. Tests for digest job + instant-only gating.

**Outcome:** all shipped. Deleted `contexts/SocketContext.jsx` (was dead) + fixed the stale Socket.io help copy. `email_frequency` ('instant'/'daily'/'off') replaces the boolean (`email_opt_out` kept as legacy); migration 12 applied live. `createNotification` instant-emails only 'instant' users; `jobs.sendDigests()` batches the rest into a daily digest (20h-gated, in the scheduler). Profile→Security has a 3-way selector. **Backend 93 tests** (+3). Verified live: cadence PATCH/GET round-trips; digest job sent **1 email from the noreply sender** then **0 on a second run** (cadence gate working). **Note:** instant per-event + digest both still depend on a real provider key to actually deliver (Resend); without it they log. WebSocket real-time remains bookmarked in §7.4.

---

## 6.12 — Sprint: §7.5 Core Marketplace (bounded) — ✅ COMPLETE (2026-06-15)

Two clearest P2 wins; the escrow-paired completion handshake and the P3 items (favourites, recurring) stay deferred.

1. **Task edit + cancel** — fills a CRUD gap (no way to edit/cancel a posted task today). `PATCH /tasks/:id` (creator edits while `open`) + `PATCH /tasks/:id/cancel` (→ `cancelled`; notifies bidders). Migration 13 keeps the init file in sync with the live `tasks_status_check` (already allows `cancelled`). Frontend: Edit/Cancel controls on the creator's open task.
2. **Data-driven categories taxonomy** — mirror `locations`: migration 14 `categories` table (seeded from the hard-coded `CATEGORIES`) + public `GET /categories`; a `useCategories()` hook drives the browse filter chips (fallback to the constant). Removes the hard-coded category lock-in.

Tests for edit (authz + open-only), cancel, and `/categories`.

**Outcome:** both shipped. `PATCH /tasks/:id` (edit, open-only) + `PATCH /tasks/:id/cancel` (rejects pending bids, notifies bidders); migrations 13 (cancel status) + 14 (categories, 8 seeded) applied live; `GET /categories` + `useCategories()` drives the browse filter chips (fallback to constant); TaskDetail gained an Edit modal + Cancel button for the creator's open task. **Backend 102 tests** (+9). Verified live: create→edit (title/budget)→cancel; editing a cancelled task → 404; `/categories` → 8. Note: editing is allowed while bids exist (terms change under bidders — acceptable for MVP; lock-after-first-bid is a possible refinement). **Deferred:** two-party completion handshake (escrow-paired), saved/favourites + recurring (P3).

---

## 6.13 — Sprint: §7.5 handshake + templates/recurring — ✅ COMPLETE (2026-06-15)

(Saved/favourite tasks explicitly NOT implemented, per owner.)

1. **Two-party completion handshake** — migration 15 adds a `submitted` task status. `PATCH /tasks/:id/submit` (assignee: in_progress→submitted, notifies creator); `complete` now accepts `submitted` (or `in_progress`, so the creator can still force-complete); `PATCH /tasks/:id/request-changes` (creator: submitted→in_progress). Builds the confirm step escrow will later hook release onto. Frontend: earner "Submit work", creator "Confirm" / "Request changes".
2. **Recurring / templated tasks** — migration 16 `task_templates` (title/description/budget/deadline_days/tags/campus/recurrence/next_run_at). `routes/templates.js`: CRUD + `POST /templates/:id/use` (spawn a task now). `jobs.sendRecurring()` spawns tasks for due recurring templates on the scheduler. Frontend: a Templates manager (list / use / delete / create) in My Tasks.

Tests for submit/complete/request-changes, template CRUD+use, recurring job.

**Outcome:** both shipped. Migrations 15 (`submitted` status) + 16 (`task_templates`) applied live. Handshake: `/submit`, `/request-changes`, `complete` accepts submitted|in_progress; TaskDetail shows role/state-aware cards (earner Submit, creator Confirm/Request-changes, earner Awaiting). Templates: `routes/templates.js` CRUD + `/use`; `jobs.sendRecurring()` on the scheduler; a Templates manager (list/use/delete + create modal w/ recurrence) on My Tasks. **Backend 116 tests** (+14). Verified live: full handshake lifecycle (accept→submit→request-changes→submit→complete), template create→use→delete, and `sendRecurring` spawned 1 + advanced next_run_at. (Live verify needed a temp server — the dev backend was down; cleaned up after.)

---

## 6.14 — Sprint: §7.7 Observability & DevEx (bounded) — ✅ COMPLETE (2026-06-15)

Focused, dependency-free slice. Deferred (risky/broad): splitting `App.jsx`, full a11y audit, Playwright E2E, OpenAPI.

1. **Access logging** — request-completion log (method/path/status/durationMs/reqId), skipping `/health`. Builds on the existing request-ID + structured logger.
2. **Crash handling + capture chokepoint** — `server/observability.js` `captureException()` (structured now; Sentry-ready via `SENTRY_DSN`, same provider-stub pattern as email) + `unhandledRejection`/`uncaughtException` handlers; wired into the global error handler.
3. **DB index audit** — migration 17: `tasks(assigned_to)` (real gap), `tasks(status, created_at DESC)` (feed), `reviews(reviewer_id)`, and `pg_trgm` GIN indexes for the ILIKE search (display_name / task title / business name).
4. **DevEx** — `.github/PULL_REQUEST_TEMPLATE.md`; `SENTRY_DSN` documented in `.env.example` + runbook.
5. **Frontend tests** — a couple more (landing render + auth-modal open).

**Outcome:** shipped. Access log (one structured `request` line per call w/ status+ms+reqId, `/health` excluded — verified live, incl. a mount-path capture fix). `observability.js` `captureException` chokepoint + `unhandledRejection`/`uncaughtException` handlers (the latter caught a real EADDRINUSE live); global error handler routes through it; Sentry-ready via `SENTRY_DSN`. Migration 17 applied: `idx_tasks_assigned_to` (real gap), `idx_tasks_status_created`, `idx_reviews_reviewer_id`, + `pg_trgm` GIN on display_name/task title/business name (indexable search). PR template added; `SENTRY_DSN` in `.env.example`. Frontend **3 tests** (+2). Backend 116. **Deferred:** split `App.jsx` (risky), Playwright E2E, OpenAPI, pre-commit hooks, the actual `@sentry/node` SDK (one-step once a DSN exists).

**Accessibility pass (added 2026-06-16):** global `:focus-visible` outline; shared `Input` now associates `<label>`↔input (`useId`) + `aria-invalid`/`aria-describedby`; shared `Modal` got `role="dialog"`/`aria-modal`/`aria-labelledby` + Escape-to-close + focus-on-open + return-focus + labelled close. Discovered the **AuthModal is custom** (doesn't use shared `Modal`/`Input`) and fixed it too: dialog semantics, `aria-label`led Email/Password, Escape-to-close. Icon-only buttons labelled (search, messages, alerts w/ unread count, account menu, hamburger) with decorative glyphs `aria-hidden`. Dashboard already had a `<main>` landmark. Verified live via DOM (focus-visible present, AuthModal `role=dialog` + 2 labelled inputs + Escape closes); locked with a frontend test assertion. Still open: contrast audit, full keyboard-nav sweep of every screen.

---

## 6.15 — Sprint: §7.8 Admin & Ops — ✅ COMPLETE (2026-06-16)

Owner priorities: admins can **monitor everything** + **manage businesses**. Found: business CRUD already admin-gated + wired; but disputes/users admin pages use MOCK data, there's no stats/activity endpoint, and **no admin account exists** (10 members, 0 admins).

1. **Admin account path** — `requireAdmin` shared middleware + `server/scripts/make-admin.mjs <email>` to promote a user (no admin features are usable without one).
2. **Monitoring backend** — `routes/admin.js`: `GET /admin/stats` (users/tasks-by-status/bids/disputes/businesses + completion rate), `GET /admin/activity` (paginated `activity_logs` feed), `GET /admin/users` (paginated, searchable). Admin-only.
3. **Frontend** — Admin dashboard renders real stats + recent activity; wire AdminDisputes/AdminDisputeDetail to the real `/disputes` API (was mock); wire AdminUsers to `/admin/users`. Businesses admin already works for admins — confirm.

Tests for admin authz + endpoints.

**Outcome:** shipped + verified live. `requireAdmin` middleware; `routes/admin.js` (`/admin/stats`, `/admin/activity`, `/admin/users`, admin-only). Migration 18 **created the `activity_logs` table** (it was referenced everywhere but never defined → the audit trail had silently no-op'd for the whole project). `make-admin` script promotes a user. **AdminDashboard** (real stats + activity feed) is now the admin landing page with a nav link. **Two pre-existing bugs surfaced + fixed:** (1) `POST /businesses` 500'd whenever `feePaid` was null — `$14` reused in a value + `CASE` couldn't infer type; cast to `::numeric`. This is why "add a business" never worked. (2) Every `activity_logs` INSERT failed ("inconsistent types deduced for $1") because `$1` was reused for `actor_id` (UUID) + `entity_id` (TEXT); migration 19 makes `entity_id` UUID. **Backend 121 tests** (+5). Verified live: member→403, admin adds a business (appears in public Local directory), activity feed records logins, dashboard shows businesses=1. **To use:** run `npm run make-admin <your-email>` then sign out/in. **Deferred:** wiring AdminUsers/AdminDisputes *frontend* to the real endpoints (still mock; endpoints + AdminBusinesses already real), analytics charts, suspend/ban + dispute-resolve actions, campus-admin UI, feature flags, backup runbook.

---

## 6.16 — Sprint: §7.8 admin frontend wiring + moderation — ✅ COMPLETE (2026-06-16)

The deferred admin increment: wire the mock admin pages to the real backend + add moderation/resolution actions.

1. **User moderation** — migration 20 (`users.suspended_at`); `PATCH /admin/users/:id` (suspend/unsuspend + role change; can't self-target; bumps token_version); login rejects suspended. AdminUsers → real `/admin/users` + Suspend button.
2. **Disputes** — AdminDisputes → real `/disputes` queue; AdminDisputeDetail → real `/disputes/:id` (+ events), resolve via the existing `PATCH /disputes/:id` (resolved_creator/earner + resolution + notes). Drop the mock escrow/Stripe UI (no payments yet).

Tests for the user-moderation endpoint.

**Outcome:** shipped + verified live. Migration 20 (`users.suspended_at`); `PATCH /admin/users/:id` (suspend/unsuspend/role, can't self-target, bumps token_version); login returns 403 for suspended. **AdminUsers**, **AdminDisputes**, **AdminDisputeDetail** all rewired from mock → real APIs (disputes detail now shows reason/evidence/admin-notes/event-timeline and resolves via `PATCH /disputes/:id`; dropped the mock escrow/Stripe UI). **Backend 125 tests** (+4). Verified live: suspend→login 403→reinstate→login OK, self-suspend→400; dispute raise→admin queue=1→resolve (resolved_creator/refund, 2 events); both pages render real data via client nav. **Note:** `/admin/*` is now both an API prefix and SPA routes — full-page refresh on an admin page hits the proxy (same known limitation as `/profile`, `/messages`); client-side nav is fine. Verification left test artifacts (suspended/reinstated users, a resolved dispute).

---

## 6.17 — Sprint: §7.8 analytics, campus admin, flags, ops runbook — ✅ COMPLETE (2026-06-16)

1. **Analytics charts** — `GET /admin/analytics?days=N` time-series (signups / tasks created / tasks completed per day); inline SVG charts on the Admin dashboard (no chart lib).
2. **Campus/zone admin UI** — admin location CRUD (`POST /admin/locations`, `PATCH /admin/locations/:id` rename/activate) on top of the existing `locations` table; an admin page to add a campus/zone without SQL.
3. **Feature flags** — migration 21 `feature_flags`; `GET/PATCH /admin/flags` + public `GET /flags` + a `useFlags()` hook; admin toggle page.
4. **Neon backup/restore runbook** — `docs/OPS_RUNBOOK.md` (PITR, branch-restore, manual `pg_dump`).

Tests for analytics/flags/location-admin endpoints.

**Outcome:** all four shipped + verified live. `GET /admin/analytics` (daily signups/tasks-created/tasks-completed via generate_series) → 3 inline **SVG MiniCharts** on the dashboard (no chart lib). `POST/PATCH /admin/locations` + an **AdminLocations** page (add campus/zone without SQL). Migration 21 `feature_flags` + `GET/PATCH /admin/flags` + public `GET /flags` + `useFlags()` hook + **AdminFlags** toggle page. `docs/OPS_RUNBOOK.md` (Neon PITR/branch-restore/`pg_dump`). Admin nav gained Locations + Flags. **Backend 131 tests** (+6). Verified live: analytics 30-day series, campus+zone added (campuses=2), flag toggle reflected in public `/flags`, all pages render. Test artifacts left: "Test University"/"North Wing" locations.

---

## 6.18 — Sprint: Beta launch positioning — ✅ COMPLETE (2026-06-16)

Owner's beta-launch requirements:
1. **Brand** → "ReLivR" everywhere (scripted `/ReLiv(?!R)/`→`ReLivR`).
2. **Payments framing** — remove "live payment system" claims; say **escrow & payments (recurring, split, …) coming soon**. Hide the mock Fund-Escrow UI.
3. **Countdown** to **2026-07-07** (full launch) on the landing.
4. **Beta messaging** — "we're in beta, feedback appreciated."
5. **Feedback channel** — landing form → `POST /feedback` (stored, admin-viewable).
6. **Launch-reminder waitlist** — landing email capture → `POST /waitlist`.
7. **Beta-founder tag** — persistent badge for accounts created during beta, visible on profiles.

Backend: migration 22 (`users.beta_founder` + backfill, `waitlist`, `feedback`); public `/feedback` + `/waitlist` (rate-limited); `beta_founder` in profile/me reads; admin views. Frontend: brand sweep, payments→coming-soon copy, landing countdown + beta banner + feedback + waitlist, founder badge. Tests.

**Outcome:** all 7 shipped + verified live. Brand sweep `/ReLiv(?!R)/`→`ReLivR` (43 fixes; 0 stray on landing). Landing now has a **BetaBanner**, **LaunchSection** (live Countdown to 2026-07-07 + waitlist email → `POST /waitlist`), and **FeedbackSection** (→ `POST /feedback`). Payments reframed to **coming soon** on hero/how-it-works/pricing (Earner card now "Free during beta"). **beta_founder** (migration 22, default TRUE, backfilled) shows a **★ Founding Member** badge on public profiles. Admin can view `/admin/feedback` + `/admin/waitlist`. **Backend 135 tests** (+4). Verified live: feedback/waitlist stored + admin-visible, public profile `beta_founder: true`, landing renders all sections (screenshot confirmed).
**⚠️ Launch-day (2026-07-07) TODO:** `ALTER TABLE users ALTER COLUMN beta_founder SET DEFAULT FALSE;` and email the waitlist. **Remaining:** the deep legal/FAQ/Pricing *info pages* still contain detailed Stripe/escrow/10% prose (landing + main flows are reframed) — a copy pass for those is a follow-up.

---

## 7. Backlog & Future Considerations

Groomed 2026-06-15 by all four personas. This is the menu of work beyond the MVP
sprints — nothing here is committed to a sprint yet. **Blocker legend:**
🏢 needs a registered company · ✉️ needs an email provider (free tier is fine) ·
💳 needs payments (MVP-3) · 🐞 regression introduced by the microservice cutover.
**Priority:** P0 critical · P1 high · P2 medium · P3 nice-to-have.

### 7.1 Near-term candidates — ✅ ALL SHIPPED 2026-06-15 (see §6.8)
| Item | Theme | Status |
|---|---|---|
| Core marketplace test coverage | Quality | ✅ `tasks.test.js` + `messages.test.js` (backend now 71 tests) |
| Task-expiry job 🐞 | Marketplace | ✅ `jobs.js` `expireDueTasks` + interval scheduler + `POST /tasks/admin/expire` |
| Disputes backend | Trust & Safety | ✅ `routes/disputes.js` (raise/list/view/admin-resolve); settlement stubbed 💳 |
| Password reset + email verification ✉️ | Auth | ✅ `/auth/forgot-password` · `/reset-password` · `/verify-email`; hashed tokens, dev email stub |
| **Remaining frontend wiring** | — | ⬜ Frontend pages for reset/verify + admin disputes UI still consume mocks — see TD-11-style follow-up in §7.7 |

### 7.2 Auth & Account Security  *(bounded set shipped 2026-06-15 — see §6.9)*
- ✅ Account lockout / progressive backoff (migration 10; 423 while locked)
- ✅ "Log out all devices" (`POST /auth/logout-all` + Security-tab button)
- ✅ Account deletion + data export (`DELETE /profile/account`, `GET /profile/export`)
- ✅ Secret-rotation runbook — `docs/SECURITY_RUNBOOK.md`
- ⬜ Refresh tokens / shorter access-token TTL — **P2** (deferred: frontend auth refactor)
- ⬜ 2FA (TOTP), at least for admin/high-trust accounts — **P3** (deferred: large)

### 7.3 Trust & Safety
- Report / flag users & tasks + a moderation queue — **P2**
- Block / mute another user — **P3**
- **Verified campus affiliation via email-domain** (builds on the `locations` model) — the real trust signal behind multi-campus — **P2**
- Review-abuse guards (edit window, profanity filter; one-per-task already enforced) — **P3**
- Admin moderation for business listings — **P2**

### 7.4 Communications & Notifications ✉️  *(transactional email shipped 2026-06-15 — see §6.10)*
- ✅ **Transactional email** from a noreply sender (Resend + stub fallback) on all notification events; opt-out aware. Needs a verified domain + `RESEND_API_KEY` to go live.
- ✅ Email opt-out preference (migration 11 + Profile→Security toggle)
- ✅ **Push via email + daily digest** — per-event ('instant') or batched ('daily') via `email_frequency`; digest job in the scheduler. (Replaces native PWA push for now.)
- 🔖 **Real-time messaging via WebSocket — BOOKMARKED** (owner deferred 2026-06-15; `SocketContext` stub removed). Messaging stays poll-based + email. **P2** when revisited.
- ⬜ Native PWA push notifications — **P3** (email push covers the need for now)
- ⬜ Per-type muting / richer digest scheduling — **P3**

### 7.5 Core Marketplace  *(edit/cancel + categories shipped 2026-06-15 — see §6.12)*
- ✅ Task edit / cancel (`PATCH /tasks/:id`, `/cancel`)
- ✅ **Data-driven categories taxonomy** (`categories` table + `GET /categories` + `useCategories()`)
- ✅ Two-party completion handshake (`/submit`, `/request-changes`, creator-confirm `complete`)
- ✅ Recurring / templated tasks (`task_templates`, `/templates` CRUD+use, `sendRecurring` job)
- ❌ Saved / favourite tasks; follow a creator — **WILL NOT IMPLEMENT** (owner decision 2026-06-15)
- ⬜ Search & filter improvements (full-text, campus/distance filters) — **P2** (still open)

### 7.6 Payments & Escrow 💳🏢 (MVP-3 — parked until company registration)
- Paystack (primary) + Ozow via Paystack; ZAR — **P0 when unblocked**
- Escrow lifecycle: fund → hold → release / refund; platform fee
- Payout onboarding; transaction history; wallet / balance
- Webhook signature verification + idempotency + reconciliation
- Schema re-platform: Stripe/USD → Paystack/ZAR (see TD-3)

### 7.7 Quality, Observability & DevEx  *(observability/index/PR-template shipped 2026-06-15 — see §6.14)*
- ✅ **Access logging** (structured `request` line: status+ms+reqId) + crash handlers + `captureException` chokepoint (Sentry-ready via `SENTRY_DSN`)
- ✅ **DB index audit** (migration 17: `tasks(assigned_to)`, `(status,created_at)`, `reviews(reviewer_id)`, `pg_trgm` search indexes)
- ✅ PR template
- 🟡 Expand frontend tests — started (3 tests); more as components are extracted
- ⬜ E2E smoke (Playwright): signup → post → bid → accept — **P2**
- ⬜ Performance: split the 4.5k-line `App.jsx`, code-splitting, image optimization — **P2** (risky; needs component tests first)
- 🟡 **Accessibility** — done: focus-visible, Input label association, Modal + AuthModal dialog semantics/Escape/focus, icon-button labels, `<main>` landmark. Open: contrast audit + full keyboard-nav sweep.
- ⬜ Wire the actual `@sentry/node` SDK + DSN; OpenAPI docs; pre-commit hooks — **P3**

### 7.8 Admin & Ops  *(monitoring + business mgmt shipped 2026-06-16 — see §6.15)*
- ✅ Admin dashboard (live stats + activity feed) + `/admin/stats|activity|users` endpoints + `make-admin` script
- ✅ `activity_logs` table finally created (audit trail now records) + 2 latent bugs fixed (business create, activity insert)
- ✅ Business management works for admins (was blocked by the create bug + no admin account)
- ✅ AdminUsers/AdminDisputes/AdminDisputeDetail wired to real endpoints + suspend/ban + dispute-resolve actions (migration 20, `PATCH /admin/users/:id`)
- ✅ Analytics charts (daily signups/tasks/completions — inline SVG on the dashboard; GMV once payments land)
- ✅ Campus/zone admin UI (`POST/PATCH /admin/locations` + AdminLocations page)
- ✅ Feature flags (`feature_flags`, `/admin/flags`, public `/flags`, `useFlags()`, AdminFlags page)
- ✅ Neon backup/restore runbook (`docs/OPS_RUNBOOK.md`)
- §7.8 is now fully delivered.

### 7.9 Compliance & Legal
- POPIA: data export/erasure endpoints; re-prompt consent when the policy version changes — **P2**
- Cookie-consent banner; surface T&C/Privacy versioning in the UI — **P3**
- Age / student-status verification — **P3**

---

## 8. Session Log

- **2026-06-15 — Session 0 (induction):** Full baseline audit by all four personas. No prior state file found; created this document. Mapped monolith-vs-microservice drift (TD-1/TD-4), zero-test gap (TD-2), and Stripe-vs-Paystack payment mismatch (TD-3). Defined the 3 MVP features.
- **2026-06-15 — Session 0b (decisions ratified):** Product Owner answered all four §6 questions: monolith adopted / `services/` retired, Paystack-primary (Ozow via Paystack later), brand = **ReLivR**, **multi-campus from day one with affiliation trust tags**. Roadmap re-sequenced: MVP-2 is now **Multi-Campus Identity & Affiliation Trust Tags** (promoted ahead of payments because it's the trust backbone and reshapes the data model); payments moved to MVP-3; reviews/disputes + auth-hardening deferred to Sprint 4.
- **2026-06-18 — Pre-launch app lock + UI polish + admin seed DELIVERED:** (1) Fixed the landing header — merged the beta banner + navbar into one fixed stacked header (was overlapping); boxed the countdown cells; reframed StatsBar away from live-payment claims ("Free While in Beta" / "Secure Escrow Coming"); banner now mentions escrow coming soon. (2) **Launch gate** — single source of truth `LAUNCH_AT='2026-07-07'` in App.jsx; `isAppLocked(user)` = signed-in AND not admin AND not yet launched. Locked non-admins (sign-in OR sign-up) get a `LaunchGate` founding-member holding screen with live countdown (auto-reloads into the app at launch) instead of the dashboard; admins bypass. Logged-in users also kept off the landing (redirect to app/gate). **NOTE: client-side lock only — backend still serves non-admins; server-side enforcement is a follow-up.** (3) **Admin account** — new idempotent `npm run seed-admin <email> [password]` (creates/promotes admin, sets known password, records POPIA consent). Seeded `admin@relivr.co.za` + promoted the owner's Google account to admin. Gmail-dot footgun found: `normalizeEmail()` strips gmail dots so password login on a dotted gmail can't match — use the dedicated admin email for password login, or Google sign-in for the gmail account. Verified live: admin→Admin Dashboard, member→LaunchGate. Frontend 3 tests pass. Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-16 — Beta launch positioning DELIVERED:** Brand→ReLivR everywhere; landing gained a beta banner, a live countdown to 2026-07-07, a launch-reminder waitlist (`POST /waitlist`), and a feedback channel (`POST /feedback`); payments reframed to "coming soon" (escrow/recurring/split); `beta_founder` marker (migration 22) → ★ Founding Member badge on profiles; admin feedback/waitlist views. Backend 135 tests; verified live + screenshot. Launch-day TODO: flip beta_founder default + email waitlist. Deep info/legal pages still have payment prose (follow-up). Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-16 — §7.8 analytics + campus admin + flags + ops runbook DELIVERED:** Admin analytics endpoint + 3 inline SVG charts on the dashboard; AdminLocations page (`POST/PATCH /admin/locations`) to add campuses/zones without SQL; feature flags (migration 21, `/admin/flags` + public `/flags` + `useFlags()` + AdminFlags page); `docs/OPS_RUNBOOK.md` (Neon backup/restore). Backend 131 tests. Verified live. **§7.8 Admin & Ops is now fully complete.** Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-16 — §7.8 admin frontend wiring + moderation DELIVERED:** AdminUsers/AdminDisputes/AdminDisputeDetail rewired mock→real APIs. User moderation: migration 20 (`suspended_at`), `PATCH /admin/users/:id` (suspend/role, self-target guard, session-kill), login blocks suspended. Dispute detail resolves via `PATCH /disputes/:id` (real events timeline; dropped mock escrow UI). Backend 125 tests. Verified live (suspend/reinstate/self-guard; dispute raise→resolve; pages render real data). Admin area is now fully real. Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-16 — §7.8 Admin & Ops DELIVERED:** Admin monitoring (`/admin/stats|activity|users`, `requireAdmin`, AdminDashboard with live stats + activity feed, now the admin landing page) + `make-admin` ops script. Created the long-missing `activity_logs` table (migration 18) so the audit trail finally records. Fixed two pre-existing latent bugs the sprint surfaced: `POST /businesses` 500 on null `feePaid` (the reason "add a business" never worked) and the `activity_logs` insert type error (migration 19, entity_id→UUID). Business management confirmed working for admins. Backend 121 tests. Verified live end-to-end. **Run `npm run make-admin <email>` to get an admin account.** Deferred: AdminUsers/AdminDisputes frontend wiring, analytics, suspend/resolve actions. Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-16 — §7.7 accessibility pass:** focus-visible outline, `Input` label association, shared `Modal` + custom `AuthModal` dialog semantics (role/aria-modal/labelledby, Escape, focus mgmt), icon-button aria-labels. Verified live via DOM + a frontend test assertion. Contrast + full keyboard-nav sweep still open. Uncommitted.
- **2026-06-15 — §7.7 Observability & DevEx (bounded) DELIVERED:** Structured access logging (per-request status/ms/reqId), crash handlers + `captureException` chokepoint (Sentry-ready via `SENTRY_DSN`), DB index audit (migration 17: tasks(assigned_to) + (status,created_at) + reviews(reviewer_id) + pg_trgm search indexes), and a PR template. Backend 116 tests / frontend 3 (+2). Verified live (access log paths, crash handler caught a real EADDRINUSE, indexes created). Deferred: App.jsx split, full a11y, Playwright, OpenAPI, the @sentry/node SDK. Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-15 — §7.5 handshake + templates/recurring DELIVERED:** Two-party completion handshake (earner `/submit` → creator `/complete` or `/request-changes`; migration 15 `submitted` status) and recurring/templated tasks (migration 16 `task_templates`, `/templates` CRUD+use, `sendRecurring` scheduler job, Templates manager on My Tasks). Backend 116 tests. Verified live (full handshake lifecycle + template use + recurring spawn). Saved/favourites explicitly NOT implemented per owner. §7.5 now: edit/cancel, categories, handshake, recurring done; only search/filter improvements remain. Uncommitted on `feat/foundation-mobile-hardening`.
- **2026-06-15 — §7.5 Core Marketplace (bounded) DELIVERED:** Task edit + cancel (`PATCH /tasks/:id`, `/cancel` — open-only, rejects pending bids, notifies bidders) and a data-driven categories taxonomy (`categories` table mirroring locations, `GET /categories`, `useCategories()` driving the browse chips). Migrations 13+14 applied live. TaskDetail Edit modal + Cancel button. Backend 102 tests. Verified live (create→edit→cancel, /categories=8). Deferred: completion handshake (escrow-paired), favourites/recurring. Pushed branch `feat/foundation-mobile-hardening`; §7.5 changes uncommitted on top.
- **2026-06-15 — Committed + pushed foundation/search/security/email work** to `feat/foundation-mobile-hardening` (3 area commits on top of the earlier 4).
- **2026-06-15 — Email push + digest; WebSocket bookmarked:** Removed the dead `SocketContext` stub (real-time messaging deferred per owner). Notification delivery is now an `email_frequency` preference — 'instant' (per-event push email), 'daily' (batched digest via a scheduled `sendDigests()` job, 20h-gated), or 'off'. Migration 12 + Profile→Security 3-way selector. Backend 93 tests. Verified live: digest sent 1 then 0 (cadence gate). Still needs a Resend key to actually deliver. Branch `feat/foundation-mobile-hardening`; not committed.
- **2026-06-15 — §7.4 Transactional email (noreply) DELIVERED:** All ReLivR mail now sends from `ReLivR <noreply@relivr.app>` (env-overridable) via Resend when `RESEND_API_KEY` is set, else logs a dev stub. `createNotification` emails recipients on all events (bids/awards/reviews/disputes/messages), opt-out aware; security mail always sends. Migration 11 (`email_opt_out`) + Profile→Security toggle + new-message notifications. Backend 90 tests (+6). To go live: verify a domain with Resend + set the key. Deferred: WebSocket real-time, PWA push, email digest. Branch `feat/foundation-mobile-hardening`; not committed.
- **2026-06-15 — §7.2 Auth & Security (bounded) DELIVERED:** Per-account login lockout (progressive backoff), `POST /auth/logout-all`, account deletion (POPIA anonymise + `deleted_at`), `GET /profile/export` (POPIA portability), and `docs/SECURITY_RUNBOOK.md`. Migration 10 applied live. Profile→Security tab wired (download data / sign out everywhere / delete account). **Backend 84 tests** (+10). Refresh tokens + 2FA deferred as separate efforts. Branch `feat/foundation-mobile-hardening`; not committed.
- **2026-06-15 — Universal search + public profiles:** Added `GET /search?q=` (people + businesses + open tasks, ILIKE, ≤8 each, public, +3 tests → **74 backend tests**). Frontend: top-bar search is now a real input (visible on all screen sizes) → a new `SearchResults` page (`/search`) with clickable People→public profile, Businesses→Local, Tasks→detail. **Public-profile viewing was already wired** (PublicProfile component, clickable creator/bidder names via `openProfile`, `/u/:id`) — verified working from both search results and the task/bid menu. Also fixed the **Vite dev proxy** to forward `/locations`, `/disputes`, `/search` to the backend (previously `/locations` silently fell back to the hard-coded list in dev). Minor known item: the mobile top-bar search is narrow. Caught & fixed a render crash (`initials` was component-scoped). Branch `feat/foundation-mobile-hardening`; not committed.
- **2026-06-15 — §7.1 Near-term Hardening sprint DELIVERED:** All four near-term P1 items shipped with tests. Task-expiry job + scheduler (fixes the cutover regression), disputes backend (raise/list/view/admin-resolve), password reset + email verification (hashed single-use tokens, enumeration-safe, dev email stub), and core marketplace test coverage. Backend **71 tests** (was 37). Migration 09 applied to live DB; new endpoints verified live. Settlement stays stubbed until escrow (TD-3). Frontend pages for reset/verify + disputes admin UI are the remaining wiring. Branch `feat/foundation-mobile-hardening`; not committed.
- **2026-06-15 — MVP-3 parked + backlog groomed:** Owner parked MVP-3 (Paystack) until a company is registered (Paystack onboarding requires a registered entity). Codebase audit surfaced four ready-now gaps — untested core marketplace, broken task-expiry (🐞 cutover regression), missing disputes backend, no password-reset flow — captured alongside a full themed backlog (auth, trust & safety, comms/email, marketplace, quality, admin, compliance) in new **§7**. Branch `feat/foundation-mobile-hardening` holds the 4 prior commits (unpushed). No code built this turn.
- **2026-06-15 — Debt paydown sprint DELIVERED (TD-5..12):** Cleared the 1 orange + 6 yellow debt items. JWT revocation via `token_version` (logout/password-change kill sessions, verified live), fail-fast env validation, structured JSON logging + request IDs (all `console.error` converted), README rewrite, frontend Vitest/RTL smoke test in CI, `useLocations()` wiring, and a `npm run migrate` runner that applied 07+08 to the live DB + `location_id` normalization. Backend 37 tests / frontend 1, all green. Caught & fixed a Google-login lockout bug in self-review. Only TD-3 (Paystack) + TD-9 (commit) remain. **Work still unstaged — not committed.**
- **2026-06-15 — Mobile optimization pass (roadmap paused at owner's request):** Drove the live frontend via preview at 375px & 1280px. Found & fixed: (1) top-bar nav cramped on mobile — an inline `display:flex` on `.topbar-nav` was defeating the `display:none` mobile rule; removed it. (2) Task-detail (`1fr 320px`) and dispute-detail (`1fr 300px`) were **unclassed** inline grids that didn't collapse — added `.stack-mobile`. (3) Landing hero left a full empty screen (`min-height:100vh` + hidden visual) — added `.hero-section` to drop it on mobile. (4) Messages master-detail was squished two-pane — added one-pane-at-a-time behaviour (`.msg-shell.has-active`) + a mobile ← back button. Verified Browse/Post/Profile clean; desktop unchanged. Tooling: added `.claude/launch.json`; `vite.config.js` port now honours `$PORT`. **Side effect:** created 1 test user + 2 tasks in the dev DB via API for testing (`mobiletest+886633846@demo.com`).
- **2026-06-15 — Sprint 2 (MVP-2) DELIVERED:** Trust layer + scalable location model. Found the reviews/ratings backend already built & correct → hardened it (comment cap, self-review guard) and **tested it** (was untested). Added data-driven `locations` taxonomy (migration + `GET /locations`) and replaced the hard-coded Rhodes `CAMPUS_ZONES` with a shared fail-open DB validator — new campuses are now data, not code. **32 tests passing** (from 17). Tests caught a real express-validator async-`.custom()` bug. Surfaced TD-11 (frontend should consume `/locations`) and TD-12 (migration unrun in this env + `location_id` normalization deferred). Work unstaged — **not committed**. **Next: Sprint 3 (MVP-3 — Paystack escrow) on command.**
- **2026-06-15 — MVP-2 re-scoped (owner-delegated decision):** Trust mechanism changed from affiliation tags → **5-star ratings/reviews** (campus-agnostic, scales to national). Affiliation dropped. MVP-2 is now **(A) Reviews & Ratings + (B) a generalised, optional location taxonomy** that replaces the Rhodes-only `CAMPUS_ZONES` enum so the audience is never schema-limited. GTM confirmed: Rhodes → campuses → all of SA. Reviews pulled forward from Sprint-4; disputes stay in Sprint-4.
- **2026-06-15 — Sprint 1 (MVP-1) DELIVERED:** Test/CI foundation + monolith cutover. App extracted to `server/app.js` for testability; 17 Vitest/Supertest tests green; `docker-compose.yml` cut over to the monolith (+ `server/Dockerfile`); legacy `services/`+`gateway/` archived to `legacy/`; GitHub Actions CI added. Resolved TD-1, TD-2, TD-4; surfaced TD-10 (frontend untested). Work is unstaged — **not committed pending owner's go**. **Next: Sprint 2 (MVP-2) on command.**
