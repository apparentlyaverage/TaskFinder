# Relivr — Architectural State

> Persistent state file for the autonomous development agency.
> **Read this first at the start of every session.**
> Last updated: 2026-06-30 — **Phase 2: task-core (B1–B7), A2 student-QR, and C1–C3 handshakes ALL COMPLETE.** **C1/C2/C3** (migration 43): a two-party **price handshake** on awarded tasks — `task_agreements` table + `tasks.agreed_amount` (the on-platform source of truth, seeded from the winning bid at award). Either party `POST /tasks/:id/agreements` (propose, profanity-checked); the OTHER `…/respond` (accept→writes `agreed_amount`, decline); `GET …/agreements` history. Frontend: a **`StatusTimeline`** stepper + a **`TaskAgreementPanel`** (propose / accept-decline / history) on the task detail for the two parties. **Verified live end-to-end:** award→agreed R280 → creator proposes R350 → earner accepts → `agreed_amount` synced to **R350** (screenshot of the panel showing "R350 · accepted" + "Propose to …"). Backend **254 tests green**; frontend builds clean. Migration 43 on Neon; QA task cleaned up. *(Milestones deferred — the timeline + existing submit/request-changes/complete cover task management for now.)* **Phase-2 remaining: only A1** ID verification (scaffold pending your provider + SA legal). Earlier this phase: A2 student-discount QR (migration 42, `qrcode`); B-group task cards/filter/duration/deadline/extend/cancel. `campus_deals.student_only` + a `student_domains` allowlist (ru.ac.za, relivr.test) + a `deal_claims` token table. Flow: a (verified-student, for student-only deals) customer **claims** a deal → one-time token rendered as a **QR** (client-side `qrcode` lib) + short code; the business **scans/enters** the code (`POST /deals/redeem-token`) which records a normal `deal_redemption` (Client History unchanged) and spends the claim. "Verified student" = verified email whose domain is allowlisted. Deal form gains a "Students only" toggle; cards show a 🎓 badge; the business Deals tab gains a "Redeem a code" input. Backend **249 tests green**; frontend builds clean (qrcode bundled). **Verified live** (preview reconnected): created a student-only deal (201), claimed it as a verified student → **QR modal rendered** (PNG QR + code), badge shows; redeem-token/student-gate/wrong-business covered by tests. Migration 42 on Neon; QA test deals cleaned up. **Earlier B-group:** image-free colour-coded cards, better-profane-words filter (GPLv3), duration, bidding deadline, extend, cancel reason. **Phase-2 remaining: A1** ID verification — scaffold only, needs your **provider choice + SA legal sign-off**.

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

## 0.1 — Autonomous Team Operating Protocol (adopted 2026-06-23)

Supplements §0. Engaged at the owner's request to run this project as a self-directing full-stack team. **Mandate:**
1. **Persistence** — read this file at the start of every session/turn for context, current tasks, and blockers.
2. **State management** — after *every* development or planning action, update this document **in its existing format** (the rich log below — not a skeleton) so it always reflects reality.
3. **Role adoption** — simulate five roles on each task (splits the combined QA & Security persona above into two):

| Role | Responsibility |
|---|---|
| **Product Manager** | Defines the goal + user requirements. |
| **Architect** | System/microservice design integrity, scalability. |
| **Lead Developer** | Clean, modular code. |
| **QA Engineer** | Test cases, mocks, edge-case scenarios. |
| **Security Officer** | Vulnerabilities, injection risks, dependency security. |

**Per-response format:** (1) **Team Sync** — the team's current assessment; (2) **Execution** — the coding/debugging/planning; (3) **QA/Security Report** — how the work was validated; (4) **State Update** — this document, refreshed.

**Quick-glance status** (lightweight skeleton kept current alongside the detailed §8 log):
- **CURRENT SPRINT GOAL:** Cookie-consent banner + sweep remaining stale copy to match the policy.
- **STATUS:** ✅ Done. **Cookie banner** (`CookieConsent` in `App.jsx`, mounted globally): first-visit Accept all / Reject non-essential / Customise-by-category; strictly-necessary always on, non-essential default OFF (no pre-ticking); versioned consent in `localStorage` (`rl_cookie_consent`); re-openable via the `relivr:cookie-prefs` event from a **footer "Cookie preferences"** link and a **Cookie Policy "Manage preferences"** button. **Copy sweep:** Stripe→Paystack and Rhodes-SSO→verified `@ru.ac.za` email across HowItWorks, Features, Trust & Safety, Help Centre + the escrow modal; dropped the false "(PTY) Ltd registered" footer claim. Frontend builds clean; **verified in-browser** end-to-end (banner shows → Customise toggles → Accept all persists versioned consent → reopens from the event). (Prior: legal pages rewritten to the revised policy.)
- **COMPLETED (recent):** signed `/uploads/signature` endpoint (auth + ownership-locked folder + signed `allowed_formats`); upload UI wired into owner + admin editors; `cover_image_url` made public; prod end-to-end upload verified via a `@relivr.test` business account.
- **PENDING (backlog top):** ✅ **Scaling roadmap (§7.11) COMPLETE** — god-mode + task TTL, Client History, follow graph, recurring specials all delivered. **Next candidates:** MVP-3 payments (TD-3, parked on company reg.); UI redesign **pass 2**; Campus Deals follow-ups (campus filter chips, deal view beacons); launch-day TODOs (flip `beta_founder` default → FALSE, email waitlist, clean test records).
- **SECURITY AUDIT LOG:** **God-mode** — every admin mutation flows through the `audit()` chokepoint → append-only `activity_logs` (actor/action/entity/before/after/reason); destructive ops take a `reason`; self-target guards kept (no self-suspend/-delete); god-mode is `requireAdmin`-only (business role can't reach it). Verified live: a moderation write appeared in `/admin/audit` with its reason. **Open follow-up:** admin **2FA** still deferred (§7.2) — worth doing before broad delete usage; tamper-evident hash-chaining of the audit log is a stretch. Backend **208 tests** green.
- **NEXT ACTION:** Cookie banner + copy sweep done; the Cookie Policy's banner promise is now true and no Stripe/SSO references remain in the frontend. **Owner to-do:** SA privacy-attorney review (retention periods + operator agreements); source-of-truth doc `RELIVR POLICY DOCUMENT (revised).docx` in Downloads. **Note:** the banner records consent; there are no third-party analytics/ad scripts to gate yet — when one is added, gate it on `getCookieConsent().analytics`. Then: UI redesign pass 2 or MVP-3 payments.

---

## 1. Product Snapshot

**ReLivR** (canonical brand, ratified 2026-06-15) is a **peer-to-peer service marketplace**. Creators post tasks; Earners bid and fulfil them. Localised to South Africa (POPIA consent, SA phone normalisation, ZAR).

**Go-to-market:** launch at **Rhodes University** → expand campus-by-campus → eventually all of South Africa. **Architectural rule that follows from this:** never bake Rhodes-only assumptions into the data model. Location is a **generalised, optional, hierarchical** taxonomy (campus → region → national), used for scoping/filtering — *never* as a gate on who can join.

**Trust mechanism (decided 2026-06-15):** a standard **5-star rating/review system**, not affiliation tags. Ratings are campus-agnostic, so they scale unchanged from one campus to the whole country. The earlier "affiliation trust tag" idea is **dropped** — tying trust to a verifiable campus would cap the addressable audience, which contradicts the national goal.

- **Frontend:** React 18 + Vite (`frontend/`) → Vercel
- **Backend:** **Consolidated Express monolith** (`server/`) → Railway. Modular via routers.
- **DB:** PostgreSQL 16 (Neon); schema in `db/init/*.sql`, **migrations 01–32 applied** (latest: `32_campus_deals.sql`). ~30 tables. Migrations are idempotent (`IF NOT EXISTS`) and applied via `npm run migrate` (no framework).
- **Auth:** Local (bcrypt) + Google OAuth, JWT-based (stateless)
- **Background work:** centralised in `server/jobs.js` (`startScheduler` from `index.js`) — task expiry, deal expiry, digests, recurring tasks. **Design rule:** time-based *visibility* is enforced at **query time** (`WHERE … expires_at > NOW()`); scheduler jobs are for state hygiene/recurrence/archival, never the sole gate. New scaling jobs (recurring-deal refresh, task archival — §7.11) extend this scheduler.

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
| TD-3 | 🟠 In progress | **Payments re-platform.** Paystack/ZAR foundation landed (2026-06-21): migrations 23–30 (ZAR escrow, subscriptions), `server/routes/payments.js` (initiate/verify/HMAC-SHA512 webhook/release + business onboarding), `env.js` warns non-fatal on missing `PAYSTACK_SECRET_KEY`. **Remaining for go-live:** full escrow lifecycle wiring to task completion, set `PAYSTACK_SECRET_KEY` in Railway, reconciliation/idempotency hardening, company registration (Paystack onboarding). → **MVP-3** | Architect + Dev |
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
- ⚠️ Saved / favourite tasks; follow a creator — *was* WILL NOT IMPLEMENT (2026-06-15). **Follow is now back in scope — superseded by the owner's scaling request 2026-06-23 (see §7.11.1).** (Saved/favourite tasks remain out of scope.)
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

## 7.10 — Campus Deals (PIVOT) — Feature Design & Stack (2026-06-23) — ✅ DELIVERED

**Shipped (2026-06-23):** migration `32_campus_deals.sql` (applied to Neon); `server/routes/deals.js` (public active-filtered read, owner CRUD, admin moderation) mounted at `/deals`; `jobs.expireDeals()` on the scheduler; `/uploads/signature` extended with a `deals` folder scope; frontend `DealCard`/`DealForm`/`BusinessDeals` (dashboard "Deals" tab), public `DealsPage` (`/deals` + nav), `AdminDeals` (moderation + nav); Vite `/deals` proxy. Backend **191 tests** (+20: 18 deals + 2 expireDeals). Verified in-browser on a local full-stack as `biz01@relivr.test`: created a deal → appeared in the owner list (Active · countdown · price) and in the public query (authed bypass), token-less public fetch correctly 503'd by the gate; test deal deleted after. The design below is the as-built spec.

**Owner pivot:** add a **Campus Deals** system — businesses post time-limited "Limited Time Specials" (title, description, image, price, expiry); a public, **campus-wide, responsive** Deals page shows only **active** (un-expired) deals. Deliberately **reuses existing infra** — the `business` role, `businesses.owner_id` ownership-gating, Cloudinary signed uploads, the `locations` campus taxonomy, RBAC middleware, and the `jobs.js` scheduler — so **no new technical stack is required.**

### RBAC matrix
| Capability | Public | Business (owner) | Admin |
|---|---|---|---|
| View **active** deals (public page) | ✅ | ✅ | ✅ |
| Create / edit / archive **own** deals | ❌ | ✅ own only | ✅ any |
| See own draft/expired deals | ❌ | ✅ own | ✅ all |
| Moderate / remove **any** deal | ❌ | ❌ | ✅ |
| Manage main site / static content | ❌ | ❌ | ✅ |

Enforcement reuses the proven `businesses.js` pattern: `requireAuth` + **ownership gate** (`business_owner_id = req.userId`), never role alone — a business can never write another owner's deal, set `status`/`location` beyond its allowance, or touch static content. Admin paths via `requireAdmin`.

### Schema — migration `db/init/32_campus_deals.sql` (idempotent)
```sql
CREATE TABLE IF NOT EXISTS campus_deals (
  deal_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  business_owner_id    UUID NOT NULL REFERENCES users(user_id)          ON DELETE CASCADE,
  location_id          UUID REFERENCES locations(location_id) ON DELETE SET NULL, -- NULL = all campuses
  title                VARCHAR(120) NOT NULL,
  description          TEXT,
  image_url            TEXT,
  price_cents          INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),  -- ZAR cents
  original_price_cents INTEGER CHECK (original_price_cents IS NULL OR original_price_cents >= 0),
  status               VARCHAR(16) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('draft','active','expired','archived')),
  starts_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_deal_window CHECK (expires_at > starts_at)
);
-- Hot path (public page): only live rows, ordered soonest-ending. Partial index stays tiny.
CREATE INDEX IF NOT EXISTS idx_deals_live     ON campus_deals (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_deals_owner    ON campus_deals (business_owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_business ON campus_deals (business_id);
```
`business_owner_id` is denormalised from `businesses.owner_id` (set server-side at create) for O(1) ownership checks + audit, mirroring the business-dashboard ownership model. `location_id` reuses the existing UUID `locations` taxonomy (NULL = visible on every campus).

### Retrieval — "active" is enforced at QUERY time (the safety guarantee)
```sql
SELECT d.deal_id, d.title, d.description, d.image_url, d.price_cents, d.original_price_cents,
       d.expires_at, b.business_id, b.name AS business_name, b.logo_url, b.category
  FROM campus_deals d
  JOIN businesses b ON b.business_id = d.business_id
 WHERE d.status = 'active'
   AND d.expires_at > NOW()          -- ← DB SERVER CLOCK; cannot be bypassed by any client
   AND b.status = 'active'
   AND ($1::uuid IS NULL OR d.location_id = $1 OR d.location_id IS NULL)  -- optional campus filter
 ORDER BY d.expires_at ASC
 LIMIT 100;
```
**Why this is safe:** the `expires_at > NOW()` predicate uses the **database server clock**, is **atomic**, and runs on **every read** — an expired deal becomes invisible the instant it lapses, independent of any background job, client clock, or cached state. A client-side countdown is display-only and never trusted for access.

### Background sweep — housekeeping only (NOT relied on for hiding)
`server/jobs.js` gains `expireDeals()` (mirrors `expireDueTasks`): `UPDATE campus_deals SET status='expired', updated_at=NOW() WHERE status='active' AND expires_at <= NOW()`, wired into `startScheduler` (5-min tick). Purpose: keep `status` truthful for owner dashboards/analytics. Correctness does **not** depend on it — the query filter already hides expired rows even if the job never runs.

### API surface — `server/routes/deals.js` (mounted `/deals`)
- `GET /deals` (public) — active deals, optional `?campus=<location_id>`.
- `GET /deals/:id` (public) — single active deal (404 if expired/inactive, same as `/businesses/:id`).
- `GET /deals/mine` (business) — all own deals incl. draft/expired.
- `POST /deals` (business) — create; `business_id`/`business_owner_id` derived server-side from the caller's business; `expiresAt` must be a future ISO datetime (express-validator).
- `PATCH /deals/:id` (business own) — whitelist: title/description/image/price/expiresAt/status∈{active,draft,archived}; never owner/business_id.
- `DELETE /deals/:id` (business own | admin any) — or soft `archived`.
- `GET /admin/deals` + moderation (admin).
- Image upload reuses `POST /uploads/signature` with a new `deals` folder scope (`relivr/deals/<businessId>`).
- Gate note: `business` role already bypasses the pre-launch gate, so owners can create deals before 7 July. **Open decision:** is the public `/deals` page open pre-launch (add to `PRE_LAUNCH_OPEN`) or gated until 7 July?

### UI/UX flow
**Business Dashboard → new "Deals" tab** (beside My Page / Analytics):
1. List of the owner's deals with status chips (Active · "Ends in 2d 4h" · Expired · Draft) + thumbnail + price.
2. "＋ New deal" → form: title, description, price (ZAR), **image upload** (existing `ImageUpload`), **expiry date-time picker** validated future-only with quick presets (24h / 3 days / 1 week), optional campus. Live preview of the deal card.
3. Per-card Edit / Archive / Duplicate. Expired deals are read-only with a "Repost" action (clone + new expiry).

**Public Deals page** (`/deals`, nav "Campus Deals"):
- Responsive card grid (image, title, business name+logo, price + optional struck-through original, "Ends in …" countdown).
- Campus filter chips (reuse `useLocations()`); empty state ("No live deals right now").
- Card → deal detail / business page; fires a lightweight view beacon (reuse the `business_page_events` pattern).

**Admin → AdminDeals**: table of all deals, filter by status/business, hide/remove any.

### Technical stack — no new infrastructure
- **PostgreSQL `TIMESTAMPTZ` + query-time `WHERE expires_at > NOW()`** — authoritative, server-clock, atomic expiry (THE safety mechanism).
- **Partial index** `WHERE status='active'` + **`CHECK (expires_at > starts_at)`** DB constraint.
- **express-validator** future-date check on create/update (defence-in-depth; the query is the real guard).
- **`jobs.js` scheduler** sweep for status hygiene/analytics (not correctness).
- **RBAC middleware** (`requireAuth` + ownership gate; `requireAdmin`) reused from `businesses.js`.
- **Cloudinary signed uploads** reused (new `deals` folder scope).
- **React 18 + Vite** frontend; countdown display-only.
- **Vitest + Supertest** tests — RBAC (owner-only writes, admin moderation, public read) + a critical **expiry test** (a deal with `expires_at` in the past is absent from `GET /deals`).

### Proposed build order (each step tested before the next)
1. Migration 32 + `expireDeals()` job + scheduler wiring.
2. `routes/deals.js` (public active-filtered read + owner CRUD) + mount + tests (incl. the expiry test).
3. Admin moderation endpoint + tests.
4. Frontend: Business Dashboard "Deals" tab (list + create/edit form + image upload + expiry picker).
5. Frontend: public `/deals` page + nav + campus filter; AdminDeals page.
6. Verify in-browser (local full-stack, `@relivr.test` business) + deploy.

---

## 7.11 — Scaling Roadmap: social graph · business upgrades · god-mode admin — BACKLOG (2026-06-23)

Owner scaling request. Captured + prioritised; **nothing committed to a sprint yet** (per §7 convention). Priority legend as §7 (P0 critical … P3 nice-to-have). The requested drafts (schema, god-mode API, expiration scheduler) are inline below.

**⚠️ Reverses a prior decision:** the **Follow system** supersedes the 2026-06-15 "follow a creator — WILL NOT IMPLEMENT" call (§7.5). Following is back in scope.

### Priority & suggested sequence (Architect + PM)
| # | Item | Priority | Why / dependency |
|---|---|---|---|
| 1 | **Audit-logging chokepoint** (god-mode) | ~~P1~~ ✅ | **DELIVERED 2026-06-24** — `server/audit.js` `writeAudit()` → append-only `activity_logs`, called by every admin mutation; `GET /admin/audit` feed. |
| 2 | **Task TTL / archive** | ~~P1~~ ✅ | **DELIVERED 2026-06-24** — migration 34 (`tasks.expires_at/archived_at`) + `jobs.archiveExpiredTasks` + feed filter `archived_at IS NULL`. |
| 3 | **Recurring specials** (deals) | ~~P2~~ ✅ | **DELIVERED 2026-06-24** — mig 36 (`recurrence`/`active_window_s`) + `jobs.refreshRecurringDeals()` refresh-in-place + form "Repeat" selector + ↻ badge. See §8 log. |
| 4 | **God-mode full-CRUD admin endpoints** | ~~P2~~ ✅ | **DELIVERED 2026-06-24** — `/admin/tasks` (GET/PATCH/DELETE), `/admin/users` DELETE (soft), audited deal override; AdminTasks + AdminAudit pages. |
| 5 | **Follow / social graph** | ~~P2~~ ✅ | **DELIVERED 2026-06-24** — `follows` (mig 35), follow/unfollow + counts + state + feed, FollowButton + Following page. See §8 log. |
| 6 | **Client History dashboard** | ~~P3~~ ✅ | **DELIVERED 2026-06-24** — built the `deal_redemptions` precursor (mig 33) + redeem endpoint + Client History aggregation + Clients tab. See §8 log. |

### 7.11.1 — Social & relationship graph
**Follow system — ✅ DELIVERED 2026-06-24 (see §8 log).** Built as designed: `follows` (migration 35), `routes/follows.js` (`POST /follows`, `DELETE /follows/:type/:id`, `GET /follows/state/:type/:id` for button state + counts, `GET /follows/me` feed), notify-on-new-follower, self-follow guard, target-existence check. Frontend: `FollowButton` (on public profiles + business pages) + a **Following** page/nav. *Original design:* one many-to-many table, polymorphic target so a user follows users *and* businesses with one feed query:
```sql
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_type  VARCHAR(10) NOT NULL CHECK (target_type IN ('user','business')),
  target_id    UUID NOT NULL,                 -- users.user_id | businesses.business_id (polymorphic; app-enforced)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, target_type, target_id)
);
CREATE INDEX idx_follows_target   ON follows (target_type, target_id);  -- "who follows X" + counts
CREATE INDEX idx_follows_follower ON follows (follower_id);             -- "X's following feed"
```
- App guards: no self-follow; validate the target exists on write.
- **Caveat:** a polymorphic `target_id` can't be a hard FK — deleting a target orphans rows; clean up in the entity-delete path or a periodic sweep. *Alternative:* two typed tables (`user_follows`, `business_follows`) with real FKs + cascade both sides — choose this if referential integrity outweighs single-feed simplicity.
- Endpoints: `POST /follows` `{targetType,targetId}` · `DELETE /follows/:type/:id` · `GET /follows/me` · `GET /users/:id/followers` · `GET /businesses/:id/followers` (+ follower counts on profile/business reads). Notify the target on a new follower (reuse `createNotification`).

**Client History dashboard — ✅ DELIVERED 2026-06-24 (see §8 log).** The deal-redemption precursor below was built: `deal_redemptions` (migration 33), `POST /deals/:id/redeem` (customer claims an active deal; per-day dedup via a unique index; can't redeem own deal), and `GET /deals/mine/clients` (aggregation: total/unique/repeat customers, total value, 30-day series, recent list). Frontend: "Claim deal" button on public deal cards + a business-dashboard **Clients** tab. Verified E2E in-browser. *Original design:* businesses view/analyse their client base; no business↔customer transaction existed (businesses list + post deals; they don't fulfil tasks), so a **deal redemption / booking** record was defined first:
```sql
CREATE TABLE deal_redemptions (
  redemption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       UUID REFERENCES campus_deals(deal_id) ON DELETE SET NULL,
  business_id   UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_cents  INTEGER
);
```
Client History then aggregates redemptions per business (unique customers, repeat rate, spend, timeline). **POPIA:** a customer must consent to a business retaining their identity; otherwise expose aggregate/anonymous metrics only.

### 7.11.2 — Business management upgrades
**Recurring specials — ✅ DELIVERED 2026-06-24 (see §8 log).** Built as designed: migration 36 (`recurrence`, `recurrence_until`, `active_window_s`), `jobs.refreshRecurringDeals()` (refresh-in-place on the scheduler, runs after `expireDeals`), deal-form "Repeat" selector, ↻ badge on cards/list. *Original design:* extend `campus_deals`:
```sql
ALTER TABLE campus_deals
  ADD COLUMN recurrence       VARCHAR(10) NOT NULL DEFAULT 'none'
                                CHECK (recurrence IN ('none','daily','weekly','monthly')),
  ADD COLUMN recurrence_until TIMESTAMPTZ,     -- optional end of the series
  ADD COLUMN active_window_s  INTEGER;         -- how long each cycle stays live (defaults to the first window)
```
Server logic — new `jobs.refreshRecurringDeals()` on the scheduler: for each deal `status='expired' AND recurrence<>'none' AND (recurrence_until IS NULL OR NOW() < recurrence_until)`, **re-activate in place** — `status='active', starts_at=NOW(), expires_at = NOW() + active_window_s (or +1 interval), updated_at=NOW()`. Idempotent (gated on `expired`). Refresh-in-place (not spawn) keeps one stable "Tuesday special" row; cycle history lives in page-events. Ops manual trigger like the existing `POST /tasks/admin/expire`.

**Task expiration / global TTL — ✅ DELIVERED 2026-06-24** (migration 34 + `jobs.archiveExpiredTasks` + feed filter). Tasks already auto-expire *open* past-`deadline` (`jobs.expireDueTasks`); this added a hard TTL + archival:
```sql
ALTER TABLE tasks
  ADD COLUMN expires_at  TIMESTAMPTZ,   -- optional hard TTL, independent of deadline
  ADD COLUMN archived_at TIMESTAMPTZ;   -- set by the archive sweep; excluded from default feeds
```
Server logic — new `jobs.archiveExpiredTasks()`: archive where `expires_at < NOW()` OR terminal (`completed`/`cancelled`/`expired`) older than a retention window; default browse/feed queries gain `AND archived_at IS NULL`. Authoritative visibility stays a **query-time filter** (same lesson as deals); the sweep is hygiene + retention (POPIA data-minimisation).

### 7.11.3 — God-mode admin panel — ✅ DELIVERED 2026-06-24
Foundation already exists (§6.15–6.17 + AdminDeals): `requireAdmin`, `/admin/stats|activity|users|analytics|flags|locations`, user suspend/role, dispute + business + deal moderation, and the `activity_logs` table (mig 18). God-mode = **(a) full CRUD on every entity + (b) audit EVERY action.**

**Audit chokepoint (P1 — build first):** a shared `audit({ actorId, action, entityType, entityId, before, after, reqId })` writing append-only to `activity_logs`, called by *every* admin mutation — ideally an Express wrapper around admin write handlers so it can't be forgotten. Append-only; destructive actions require a `reason`. Stretch: hash-chain rows for tamper-evidence.

**God-mode endpoints (all `requireAdmin`, all audited):**
| Entity | Endpoints |
|---|---|
| Users | `GET /admin/users` (✓), `PATCH /admin/users/:id` (✓ suspend/role) → **add** `PUT` (full edit), `DELETE` (soft-delete/anonymise), `GET /admin/users/:id/activity` |
| Tasks | `GET /admin/tasks`, `PATCH /admin/tasks/:id` (override status/fields), `DELETE /admin/tasks/:id` |
| Deals | formalise `PATCH/DELETE /admin/deals/:id` (today via ownership-bypass + `GET /deals/admin/all`) |
| Businesses | existing admin CRUD (✓) — fold through the audit chokepoint |
| Audit view | `GET /admin/audit?entity=&actor=&from=&to=` over `activity_logs` |

**Security (Security Officer):** highest-risk surface. Mandate — every mutation audit-logged; keep the self-target guards (no self-suspend/-delete, ✓); `reason` on destructive ops; revisit **admin 2FA** (deferred in §7.2) *before* shipping delete powers; never expose god-mode to the `business` role (the ownership model already blocks it). Frontend: a single **AdminConsole** consolidating the existing admin pages + a global entity search + the live audit feed.

### 7.11.4 — Requested drafts (delivered inline above)
- ✅ **Data model** — follows (7.11.1) + recurring deals & task TTL (7.11.2) + deal-redemption precursor for Client History (7.11.1).
- ✅ **God-mode API surface** — 7.11.3.
- ✅ **Expiration/recurrence scheduler** — `jobs.refreshRecurringDeals` + `jobs.archiveExpiredTasks` alongside the existing `expireDueTasks`/`expireDeals`, query-time-filter-first (7.11.2).

---

## 8. Session Log

- **2026-06-30 — Phase 2 C1–C3: price handshakes + two-party task collaboration.** Migration 43: `task_agreements` (proposed/accepted/declined/superseded, one pending per task) + `tasks.agreed_amount`. **C2:** bid-accept now writes `agreed_amount` = winning bid (the on-platform source of truth; escrow will read it). **C1:** `POST /tasks/:id/agreements` — a party proposes a (new) price (note profanity-checked; supersedes any pending one; notifies the other); `POST /tasks/:id/agreements/:id/respond` — the OTHER party accepts (→ writes `agreed_amount`, transactional) or declines (proposer can't self-confirm); `GET /tasks/:id/agreements` — history (parties + admin). **C3 frontend:** `StatusTimeline` stepper (Posted→In progress→Submitted→Completed) + `TaskAgreementPanel` (shows agreed price, a pending proposal with Accept/Decline for the recipient or "waiting…" for the proposer, a propose form, and the history) mounted on the task detail for the two parties while active. **Tests:** tasks +5 (propose 201, non-party 403, inactive 409, other-accepts→sets-amount 200, proposer-self-confirm 403) → **backend 254 green**; frontend builds clean. **Verified live end-to-end** (student02 creator / student01 earner): post→bid→accept (agreed R280) → creator proposes R350 → earner accepts → `agreed_amount` = R350 on the task; UI screenshot shows the panel ("R350 · accepted", "Propose to Thabo Mokoena") + timeline + completion actions. Migration 43 on Neon; the QA task was deleted (cascade). **Deferred:** milestones (the timeline + submit/request-changes/complete already cover progress); escrow hook (parked with payments). **Phase-2 remaining: only A1** (ID-verification scaffold, pending provider + legal). **Dev note (again):** reach the task detail via client-side nav — `/task/:id` is fine, but API-colliding paths (`/deals`, `/tasks`) get proxied in dev.

- **2026-06-30 — Phase 2 A2: student-discount QR (claim → scan → redeem):** Migration 42 adds `campus_deals.student_only`, a data-driven `student_domains` allowlist (seed `ru.ac.za` + `relivr.test`), and a `deal_claims` token table (one live claim per user+deal). **`deals.js`:** `student_only` accepted on create/update + exposed on reads; `isVerifiedStudent()` = verified email whose domain is allowlisted; **`POST /deals/:id/claim`** issues a one-time token (re-claim returns the same token; student-only deals 403 for non-students); **`POST /deals/redeem-token`** lets the owning business spend a token — validates ownership + unredeemed + active, then records a normal `deal_redemption` (Client History unchanged) and marks the claim redeemed (409 on reuse, 403 cross-business, 410 expired). **Frontend:** added the `qrcode` dep; DealForm "Students only" toggle; DealCard 🎓 badge + "Get my QR"/"Show my QR"; **`DealQRModal`** (portal) renders the QR PNG + code; BusinessDeals "Redeem a customer's QR code" input. **Tests:** deals +4 (claim 201, student-gate 403, redeem 200, cross-business 403) → **backend 249 green**; frontend builds clean. **Verified live** (student01 = verified student via relivr.test): created a student-only deal (201) → claimed → **QR modal rendered** (data-URL PNG + code `TMCEOC8XPK`) + 🎓 badge on the card (screenshot). Business redeem path is test-covered (live retry blocked only by the /auth/login 5/15min rate-limit after many test logins). Migration 42 on Neon; 2 QA test deals cleaned up via a one-off DB script. **Dev note:** `/deals` is both an API path and a frontend route, so the Vite dev proxy intercepts a *browser* navigation to `/deals` (gate 503 JSON) — must navigate **client-side** in dev; prod (Vercel SPA rewrite) is unaffected. **Next:** A1 ID-verification scaffold (pending provider + legal). License: better-profane-words is GPLv3 (fine server-side).

- **2026-06-30 — Phase 2 task core (B1–B7):** **B1+B2** (`0ad76dc`) — task cards dropped the illustrated `CardCover` (gradient+emoji) for an image-free card: a category **colour** left-accent bar + a colour-tinted **icon+label chip** (`categoryFor` drives it; colour never stands alone), with status (Badge) and budget moved into the body. **B7** (`c0898bf`) — vendored **better-profane-words** (GPLv3) to `server/data/profane-words.json` (2725 terms) + `server/profanity.js`: blocks intensity≥4 or slur/hateful-ideology terms (allows casual mild), fast Set-token + phrase match; `rejectIfProfane` (422) wired into task create (title+desc), bid pitch, messages, reviews. **B3+B4+B5** (`92adec8`, migration 40) — `expected_duration` (post-form select → card meta + detail facts), `bids_close_at` (bid endpoint 409s after close; detail shows a "bidding closed" card instead of the form), and `PATCH /tasks/:id/extend` (+7 days, capped 90d, creator/open-only) wired to an "Extend +7 days" button. **B6** (migration 41) — optional `cancel_reason` captured on cancel (profanity-checked, surfaced to the declined bidders via the notification); the cancel button now prompts for a reason. **Tests:** profanity +6, tasks +4 (create-with-fields, bid-after-close 409, extend 200/404, cancel-with-reason) → **backend 245 green**; frontend builds clean. Migrations 40 + 41 on Neon. ⚠️ **Preview MCP disconnected most of the session → B3–B7 build/test-verified only, not visually.** Owner to eyeball on prod. **Next:** A2 student-discount QR; A1 ID-verification scaffold (pending provider + legal). License note flagged to owner: better-profane-words is GPLv3 (fine server-side/SaaS).

- **2026-06-30 — Phase 2 start: task cards B1 (no images) + B2 (colour-by-category):** Began the Phase-2 task-core. Replaced the illustrated `CardCover` (gradient + emoji art, 108px) on browse task cards with a clean, **image-free** card: a **category-colour left accent bar** + a colour-tinted **category chip** (icon + name, so colour is never the sole signal — A11y), budget top-right, and the status `Badge` moved into the footer. Colour comes from the existing `categoryFor()` palette (`g[1]` accent, `g[0]` chip tint), so any of the 8 categories gets a stable colour with zero new data. `CardCover` removed (dead). **Verified live** (student01, 3 seeded-then-cancelled tasks): 3 cards, 3 distinct accents (Tech purple / Tutoring amber / Moving orange), no cover images, chips show icon+label. Build clean. *(Note: B6 task-cancellation already partly exists — `PATCH /tasks/:taskId/cancel`.)* Pushed to `main`.
- **2026-06-30 — Phase 1 COMPLETE (A4 coachmarks, F1a favourites, H2 flag targeting):** Finished the roadmap's Phase 1. **A4 — first-use coachmarks:** new `FirstUseNote` (one-time, dismissible, `localStorage rl_seen_hints`) placed on the Messages + Local pages; plus a **"How ReLivR works"** item in the account menu that fires `relivr:show-walkthrough` to replay A3 (wires up the event hook left from last increment). **F1a — save/favourite providers:** migration 38 adds `follows.favourite` (favouriting upserts the follow, so it implies following); `PATCH /follows/:type/:id/favourite`, and `favourite` added to `/follows/state` + `/follows/me` (favourites sorted first). Frontend: `FollowButton` gained an optional `showFavourite` star (☆/★) on user + business profiles; the Following page marks favourites with a ★. **H2 — feature-flag expansion:** migration 39 adds `rollout_roles TEXT[]` + `rollout_percent SMALLINT DEFAULT 100`; **`GET /flags` is now viewer-aware** — it reads the optional bearer token and resolves each flag against the user's role + a deterministic `sha1(uid+flag_key) % 100` bucket (anonymous → only fully-on, role-unrestricted flags); `PATCH /admin/flags/:key` accepts any subset of `enabled`/`rollout_roles`/`rollout_percent` (backward-compatible, validated, audited via the existing `writeAudit`); the admin Flags UI gained role pills + a rollout-% input. **Tests:** follows +4 (favourite toggle/state), admin/flags +3 (targeting patch, 422 range, per-viewer eval) → **backend 234 green**; frontend 3/3; builds clean. **Verified live** (student01@relivr.test, preview reconnected mid-session): favourite ☆→★ persists + shows ★ on Following; Local first-use note renders; walkthrough replay opens from the menu event; `/flags` returns a per-user resolved map (`local_directory`/`universal_search` on, disabled `recurring_tasks` off). Migrations 38 + 39 applied to Neon. **Not visually verified:** the admin Flags targeting UI (no admin login this session; the route is test-covered). **Deferred (per brief):** flag per-campus + scheduled targeting; DB-backed onboarding flag; F1b retainers (waits on payments). Pushed to `main`.
- **2026-06-30 — Phase 1 (start): messaging icon + signup walkthrough (visually verified):** Kicked off the reviewed roadmap ([docs/FEATURE_BRIEF.md](docs/FEATURE_BRIEF.md)). **H3 — messaging icon:** the nav Messages glyph `◎` was nearly identical to the Alerts `◉` beside it → replaced with a monoline **`ChatIcon`** speech-bubble SVG (currentColor, ~1em) in both the top bar and the `NAV`/bottom-bar; `◎` no longer appears in the chrome. **A3 — signup walkthrough:** new **`OnboardingWalkthrough`** — a skippable 4-slide first-run slideshow (Welcome → Post → Bid & get hired → Local & Deals) shown once to members, persisted in `localStorage` (`rl_onboarding_seen_v1`), re-openable via a `relivr:show-walkthrough` window event, Esc-to-dismiss, dots + Skip/Back/Next/Get-started. **Mounted only inside the authed member shell** so it never renders on the public landing (the landing/auth-modal test stays green). **Verified live** as `student01@relivr.test`: walkthrough fires once, all 4 slides advance in order, finish persists + closes; messaging icon is the speech-bubble in both nav spots (DOM + screenshot), `◎` gone. Frontend builds clean; 3/3 tests pass. **Follow-ups:** persist onboarding to the DB so it follows the account (v1 is localStorage); wire a visible "replay walkthrough" trigger (event hook is ready); business-role onboarding. Pushed to `main`.
- **2026-06-30 — Fixed the failing CI "Frontend test + build" job:** `landing.test.jsx` used a bare `getByRole('dialog')` that became **ambiguous** once the POPIA **cookie-consent banner** (also `role="dialog"`) shipped (commit `d1af6de`) — two dialogs on the landing page → `getMultipleElementsFoundError` → job red on every push since. Scoped the query to the auth modal by accessible name (`/create your account|sign in/i`). Frontend suite green (3/3); build unaffected. *(Optional a11y follow-up noted to owner: the non-modal cookie bar is arguably a labelled `region`, not a `dialog`.)* Pushed to `main`.
- **2026-06-30 — Local → Instagram explore-grid + profile + photo lightbox (visually verified live):** Owner refined the brief: the directory should be a **grid** to browse, and *clicking a business* should be the Instagram experience (a profile you scroll, with a photo viewer). Reworked `LocalBrowse` accordingly. **Directory** = responsive **explore grid** (`repeat(auto-fill,minmax(220px,1fr))`) of `BizGridTile`s — a 4:3 cover image with a **"▦ N" multi-photo badge**, then a mini avatar + name + category (reverted the short-lived feed-of-posts; `BizFeedPost` deleted). **Detail** = an **Instagram profile** (max-width 935): circular logo avatar (or accent initial) + name + `FollowButton` + **"N photos"** stat row, a bio block (name, category tag, description, 📍 address, 🕒 hours), a **Call/WhatsApp/Website** action row, then a **3-column square photo grid** of all photos (`bizPhotos()` = cover + gallery, de-duped). **Tapping a photo** opens **`BizLightbox`** — a full-screen viewer: prev/next arrows, **← →/Esc keyboard**, **touch-swipe**, counter (`i / n`) + dots, and **body-scroll lock**. **Key fix:** the lightbox is **portalled to `document.body`** (`createPortal`) — rendering it inside the `.page-enter` wrapper trapped it below the sticky header (`z-90`) because the page-enter CSS *transform* creates a stacking context; the portal escapes it and the overlay (`z-1500`, above the cookie banner) now covers the whole viewport. **Verified live** (preview reconnected) as `student01@relivr.test` vs seeded Neon: explore grid (3-col @768px, 11 tiles, badges), profile (avatar/name/Follow/"2 photos"/bio/actions/3-col grid), lightbox (`portalledToBody:true`, `coversViewport:true`, scroll-locked, › advances cover→gallery to "2/2", Esc closes + restores scroll), **no console errors**. Frontend builds clean. Note: public `/businesses` doesn't return `follower_count`, so the profile's follower number comes from the `FollowButton` itself (the "N photos" stat is always shown). Pushed to `main`.
- **2026-06-29 — Local directory → Instagram-style feed (visually verified live):** Owner asked to make the businesses tab (`/local`, `LocalBrowse`) scroll like an Instagram feed. Replaced the responsive **grid of compact cards** with a **single centered 500px column** of `BizFeedPost` "posts": (1) a tappable header — circular logo avatar (or accent-glow initial) + business name (display font) + `category · address` subtitle; (2) a **full-width square (1:1) swipeable image carousel**; (3) an action row — `FollowButton` + 📞/💬/🔗 contact icon-buttons; (4) an Instagram-style caption — **bold business name** + description, with a guard that **strips a leading name echo** ("Bean There — …" so the name doesn't read twice; only strips when the name is a whole leading token). Extended `BizGallery` with optional `aspect` (responsive `aspectRatio` frame, full-width) + `radius` props — defaults keep the card/detail callers unchanged — and made the carousel arrows **`stopPropagation`** (fixes a latent bug where tapping an arrow on a card also opened the detail). Category filter centered into the same column; hero unchanged. **Preview MCP reconnected this session** → brought up the full local stack (backend :3001 → Neon, Vite :3000 proxy), signed in as `student01@relivr.test` (the `/local` consumer surface is member-only; business accounts route to their dashboard, so a `@relivr.test` *student* both bypasses the gate and sees the directory), and **verified live**: feed renders 11 seeded businesses as IG posts (picsum images, 2-img carousels w/ dots), caption dedup correct, **carousel ‹ › advances without opening detail**, **tapping a post opens the detail** (which still renders cover+gallery+contacts), desktop = centered 500px column (post left 388/right 888 @1280w), **no console errors**. Frontend builds clean. Pushed to `main`.
- **2026-06-28 — UI refine pass 2 (started; ⚠️ build-verified only):** Owner asked for "the UI redesign" and chose **"refine, don't reinvent"** scoped to **Profile & messages + business dashboard**. The **Claude_Preview MCP was disconnected this whole session**, so — rather than guess at deep visual changes I couldn't see — I shipped a *safe consistency layer* that can't break layout and validated it with `npm run build` (clean): (1) **EmptyState** restyled to an icon-in-a-circle (`--bg-elevated` disc, muted glyph) with a readable max-width message; (2) **business-dashboard tab** (`bizTab`) gets an `--accent-glow` active background + rounded top + colour/transition (clearer selected state, underline kept); (3) **follower-count** in the business header turned into an `--accent-glow` **pill**; (4) **messages conversation list** widened 220→248px so names/snippets breathe. No structural/logic changes. **Deeper visual iteration (the actual "redesign") is deferred until preview reconnects** so it can be done by eye, not blind. Owner should eyeball these on prod after deploy. Pushed to `main`.
- **2026-06-28 — Cookie-consent banner + stale-copy sweep (makes the Cookie Policy true):** Built `CookieConsent` in `App.jsx`, mounted globally (inside the providers, renders on landing + app). First visit shows a fixed bottom banner with **Accept all / Reject non-essential / Customise**; Customise expands per-category toggles — **strictly necessary** always on (checked + disabled), **analytics / functional / advertising** default OFF (POPIA: no pre-ticking; advertising labelled "not currently used"). Choice saved to `localStorage` as a **versioned** record (`rl_cookie_consent` v1, `getCookieConsent()` helper) so it isn't re-asked; re-openable anywhere via a `relivr:cookie-prefs` window event, wired to a **footer "Cookie preferences"** link and a **Cookie Policy "Manage preferences"** button. **Copy sweep** (the deferred follow-up): replaced every remaining **Stripe → Paystack** (HowItWorks getting-paid + escrow bullets, Features escrow, Trust & Safety payment safety, Help payout, fund-escrow modal) and **Rhodes-SSO → verified `@ru.ac.za` student email** (HowItWorks overview, Features trust score, Trust & Safety verification, Help) — grep confirms **0 `Stripe`/`SSO`** left in `App.jsx`; also dropped the false "(PTY) Ltd registered" + "Registered in South Africa" footer claims. Frontend builds clean; **verified in-browser** end-to-end: banner shows on first visit → Customise shows 4 toggles (necessary locked-on, rest off) → Accept all persists `{version:1, necessary/analytics/functional/advertising:true}` and closes → the event reopens it. **Note:** no third-party analytics/ad scripts exist yet to gate; when added, gate on `getCookieConsent().analytics`. Pushed to `main`.
- **2026-06-28 — Revised legal/policy doc implemented into the live site:** Reviewed the owner's "Legal & Compliance Framework" .docx, fixed it (filled placeholders, named real operators, added missing POPIA points, set Information Officer = uthando.mkwanazi@gmail.com → `RELIVR POLICY DOCUMENT (revised).docx`), then **rewrote the four in-app legal pages** in `App.jsx` to match it and reality: `TermsPage` (Acceptable Use, Payments/Paystack, Subscriptions, Refunds/Chargebacks, Disclaimer/Liability, Governing Law), `PrivacyPage` (collect/lawful/use/share/cross-border/retention/rights/automated/children/marketing/security/contact), `CookiesPage` (current-practice note: local storage, no ad cookies; consent + banner), `POPIAPage` (8 conditions, security, operators, breach via eServices portal, Information Officer). **Corrected the stale prod content:** Stripe → Paystack, removed Rhodes-SSO eligibility gate (now 18+), removed the false "ReLivR (PTY) Ltd, registered" claim, `reliv.co.za` emails → `support.relivr@gmail.com` / `uthando.mkwanazi@gmail.com`, GDPR-style "72h" breach → POPIA "as soon as reasonably possible". Disclosed real flows (deal-redemption shares your name with the business; device fingerprint; public profiles/reviews). Frontend builds clean; **verified in-browser** (/privacy + /terms render the new content; no "Stripe"; IO email present; not Rhodes-gated). **Not legal advice — owner to get a SA privacy attorney to review.** **Follow-up:** TrustSafety/Help pages + landing still reference Stripe/Rhodes (separate copy pass); cookie-consent banner still to be built to make the Cookie Policy's banner promise true. Pushed to `main`.
- **2026-06-28 — Full transactional-email catalog (plan + implementation):** Drafted the plan for *every* email type (`docs/EMAILS.md`) and built it. **New module `server/emails.js`** — one function per email type with a branded HTML+text template and the right category sender (support vs updates). **Newly added + wired:** password-changed (reset + change-password), **new-sign-in alert** (migration 37 `known_logins`; fingerprint = sha256 of the User-Agent; only alerts on a new device when the account already has a known one, so the first sign-in never self-spams; best-effort, never blocks login), welcome (on `verify-email` success), account suspended/reinstated (admin moderation), account deleted (self + admin delete; original email captured before anonymisation), waitlist confirmation (`POST /waitlist`). Verify + password-reset refactored to use the catalog. Activity mail (bids/messages/reviews/disputes/follows/redemptions + digest) already flows via `createNotification`/`jobs` (updates sender) — documented, not duplicated. **Tests:** new `emails.test.js` (catalog routing: support→reply-to+HTML, updates→no-reply, link/device payloads) + fixed `account.test.js` SQL matchers (added `email` to the delete SELECT) → **backend 227**. **Verified LIVE** via Gmail: welcome + password-changed + new-sign-in + suspended all `delivered:true` to `support.relivr@gmail.com` (HTML renders). Migration 37 on Neon. **Future (in docs/EMAILS.md):** task-deadline reminder, weekly business summary, payment receipts (MVP-3), re-engagement, email-change confirm. Pushed to `main`.
- **2026-06-28 — Connected Gmail SMTP as the email provider (no domain yet):** Owner isn't ready for a company domain, so we send via `support.relivr@gmail.com`. **Why Gmail SMTP, not Resend:** you can't verify `gmail.com` on a transactional ESP (you don't own it) and sending "as gmail" from elsewhere fails DMARC → spam. Gmail's own SMTP sends through Google (SPF/DKIM/DMARC pass), is free (~500/day), and the same inbox receives replies. **Implementation:** added `nodemailer`; `email.js` now picks a provider at runtime — **Gmail SMTP** (if `GMAIL_USER`+`GMAIL_APP_PASSWORD`) → **Resend** (if `RESEND_API_KEY`, the future once a domain exists) → **stub**. Gmail forces the From address to the authenticated account, so `gmailFrom()` keeps the category display name ("ReLivR Support"/"…Updates") but rewrites the address to `GMAIL_USER` — so the owner only needs to set `GMAIL_USER`+`GMAIL_APP_PASSWORD` (display names default correctly; `EMAIL_FROM_*` optional). `.env.example` + `env.js` document both options. **Verified with a LIVE send** to `support.relivr@gmail.com`: both Support and Updates senders returned `delivered:true` (App Password used inline for the test — never written to disk or committed). Backend **222 tests** still green. **Setup help given:** App Passwords live at myaccount.google.com/apppasswords and are hidden until 2-Step Verification is on (NOT in Cloud Console). **Owner to-do:** set `GMAIL_USER`+`GMAIL_APP_PASSWORD` in Railway; **rotate the App Password** (it was shared in chat). Migrate to Resend+domain later — code already supports it. Pushed to `main`.
- **2026-06-28 — Transactional email split into two category senders (support + updates):** Previously all mail went from one `EMAIL_FROM` (noreply). Split by purpose: **SUPPORT** (`EMAIL_FROM_SUPPORT`, default `ReLivR Support <support@relivr.co.za>`, with `reply_to = SUPPORT_REPLY_TO` so replies reach a real inbox) carries security/auth mail — **email verification** (new sign-ups) + **password reset**; **UPDATES** (`EMAIL_FROM_UPDATES`, default `ReLivR Updates <updates@relivr.co.za>`, no-reply) carries activity mail — `createNotification` (task updates, message replies, bids, reviews, disputes, follows) + the daily digest. **Implementation:** `email.js` exports the two senders + `SUPPORT_REPLY_TO`; `sendEmail` gained `from`/`replyTo` params (defaults to the generic `EMAIL_FROM`). Routed: `auth.js` verify+reset → SUPPORT; `notify.js` + `jobs.js` digest → UPDATES. `.env.example` documents all three senders. **Tests:** email.test.js extended (distinct support/updates senders, category-send) + fixed 3 test mocks of `email.js` to export the new names → **backend 222**. **Verified locally:** a stubbed `/auth/forgot-password` logged `from: ReLivR Support <support@relivr.co.za>` + `replyTo: support@relivr.co.za`. **Owner to-do (the actual "connecting"):** verify the `relivr.co.za` domain in Resend (one domain covers every `@relivr.co.za` sender), create the `support@` (monitored, for replies) + `updates@` addresses, and set `RESEND_API_KEY` + `EMAIL_FROM_SUPPORT`/`SUPPORT_REPLY_TO`/`EMAIL_FROM_UPDATES` in Railway. Note: "new logins" is currently the new-account **verification** email; a dedicated "new login detected" alert is an easy follow-up if wanted. Pushed to `main`.
- **2026-06-24 — Recurring specials DELIVERED + biz01 showcase-seeded → §7.11 scaling roadmap COMPLETE:** **Recurring deals** (the last §7.11 item): migration 36 adds `recurrence` (none/daily/weekly/monthly), `recurrence_until`, `active_window_s` to `campus_deals`; `jobs.refreshRecurringDeals()` re-activates expired recurring deals **in place** (`status='active'`, new `expires_at = NOW() + active_window_s` (captured from the first window) or the recurrence interval), gated by `recurrence_until`, wired into the scheduler **after** `expireDeals` so a just-expired recurring deal comes straight back. `deals.js` POST/PATCH accept `recurrence`/`recurrenceUntil` (POST captures `active_window_s` from the first window; PATCH keeps it in sync); `recurrence` exposed on the public read. Frontend: a **"Repeat"** selector in the deal form + a ↻ badge on deal cards + the owner's deal list. **Also:** added `follower_count` to `GET /businesses/mine` so the owner sees their followers. **Tests:** +3 (2 `refreshRecurringDeals`, 1 recurring-create) → **backend 220**. **biz01 showcase seed** — new idempotent `scripts/seed-biz01-showcase.mjs` (`npm run seed:showcase`) populated `biz01@relivr.test` on Neon: **3 deals** (½-price coffee *weekly*, free muffin *daily*, student combo *one-off*), **8 followers**, **12 redemptions** (8 unique customers, 4 repeat) spread over ~24 days — so logging in as biz01 shows live Deals (incl. recurring ↻), a populated **Client History** (Clients tab), and a follower count. So all of §7.11 (god-mode + task TTL, Client History, follow graph, recurring specials) is now done. Migration 36 on Neon. Pushed to `main`.
- **2026-06-24 — Follow / social graph DELIVERED (§7.11.1 P2):** Users can now follow other users *and* businesses. **Schema** (migration 35, applied to Neon): `follows` — polymorphic edge (`follower_id`, `target_type` ∈ user|business, `target_id`), composite PK for idempotent follows + dedup, indexes for "who follows X" (counts) and "X's feed". target_id can't be a hard FK (polymorphic) → existence checked in-app. **Backend** (`routes/follows.js`, `requireAuth`): `POST /follows {targetType,targetId}` (self-follow guard, target-existence 404, `ON CONFLICT DO NOTHING`, notifies the followed user/business owner on a *new* follow only), `DELETE /follows/:type/:id`, `GET /follows/state/:type/:id` (→ `{following, followers}` — drives the button), `GET /follows/me` (followed users + businesses). **Frontend** (`App.jsx`): `FollowButton` (shows follower count + viewer state, toggles, hidden when logged-out) wired into **public profiles** (follow users) and **business detail** (follow businesses); a new **Following** page (followed people + businesses, clickable) + top-nav + bottom-nav + route; `/follows` added to the Vite proxy. **Tests:** +9 (`follows.test.js`: follow user/business, self-follow 400, target 404, bad type 422, unfollow, state+counts, feed) → **backend 217**. **Verified E2E against the real DB** (`student01` follows `biz01`): follow→201, `state`→`{following:true, followers:1}`, `/follows/me`→["Bean There Coffee"], unfollow→200; in-browser the new **Following** nav item renders. Notify reuses `createNotification` (`follow.new`). **Note:** the polymorphic `target_id` orphans on target delete — cleaned via cascade on the follower side; a target-delete sweep is a future nicety. Pushed to `main`.
- **2026-06-24 — God-mode admin + task TTL/archive DELIVERED (§7.11 P1):** Built the two P1 scaling items. **Audit chokepoint:** `server/audit.js` `writeAudit({actorId,actorRole,action,entityType,entityId,before,after,reason,reqId})` → append-only `activity_logs` (reuses migration 18; before/after/reason ride the JSONB `metadata`, so no schema change). Best-effort but logs failures loudly. Wired into *every* admin mutation (user moderate/delete, task patch/delete, flag toggle, location create/update, and admin deal override in `deals.js`). **God-mode endpoints** (`routes/admin.js`, all `requireAdmin`): `DELETE /admin/users/:id` (soft-delete/anonymise + token bump; self-guard), `GET/PATCH/DELETE /admin/tasks[/:id]` (override status/title/TTL/archive, or delete), `GET /admin/audit?entityType=&action=` (the filterable audit feed). Extended user-moderation roles to include `business` + a `reason`. **Task TTL/archive:** migration 34 (`tasks.expires_at`, `tasks.archived_at` + partial index) + `jobs.archiveExpiredTasks()` (hard TTL past `expires_at`, or terminal tasks older than 90d) on the scheduler; public browse queries now filter `archived_at IS NULL` (visibility stays query-time-authoritative, same lesson as deals). **Frontend** (`App.jsx`): **AdminTasks** page (status filter + inline status override + archive/unarchive + delete), **AdminAudit** page (filterable feed showing action/actor/entity/reason), a **Delete** action on AdminUsers; admin nav + routes for both. **Tests:** +10 (2 archive job, 8 god-mode incl. audit-write assertions) → **backend 208**. **Verified E2E against the real DB** (temporarily promoted `student01`→admin, reverted after): `GET /admin/tasks` 200; suspending biz02 produced an `admin.user.moderate` row in `/admin/audit` *with its reason*; unsuspended + reverted cleanly. Migrations 33–34 on Neon. **Security note:** admin **2FA** still deferred (§7.2) — recommended before heavy delete usage. Pushed to `main`.
- **2026-06-24 — Deal redemptions + business Client History DELIVERED (unblocks §7.11.1):** Built the business↔customer transaction precursor so businesses get a real client base. **Schema** (migration 33, applied to Neon): `deal_redemptions` (deal_id `ON DELETE SET NULL` to keep history, business_id, customer_id, amount_cents snapshot, redeemed_at) + a **per-day unique index** so a customer can't double-claim a deal the same day but *can* re-claim a recurring deal on a later day. *Gotcha fixed:* an expression index on `redeemed_at::date` was rejected (timezone-dependent → not IMMUTABLE); switched to a stored `redeemed_date DATE DEFAULT ((NOW() AT TIME ZONE 'UTC')::date)` and indexed that. **Backend** (`routes/deals.js`): `POST /deals/:id/redeem` (auth; active-only via the same `expires_at > NOW()` guard; can't redeem own deal → 400; duplicate same-day → 409; notifies the owner via `createNotification`) + `GET /deals/mine/clients` (Client History aggregation: total/unique/repeat customers, total value, 30-day series, recent 50 with customer name + deal title). **Frontend** (`App.jsx`): "Claim deal" button on the public `DealCard` (→ "Claimed ✓") + a business-dashboard **Clients** tab (`BusinessClients`: stat tiles + reused `MiniChart` + recent list). **Tests:** +7 (5 redeem incl. 400/409, 2 client-history) → **backend 198**. **Verified E2E in a real browser** (local full-stack): biz01 posts a deal → student01 claims it ("Claimed ✓") → biz01 Clients tab shows 1 redemption / 1 unique client / R20 / "Thabo Mokoena". All test deals/redemptions cleaned up after. **Note:** local backend has no Cloudinary keys, so deal-image upload isn't testable locally (works in prod where keys are set). Pushed to `main`.
- **2026-06-23 — Scaling backlog added + prioritised (§7.11) — design/doc only, no code:** Owner scaling request captured. **Four-persona review against the live codebase first** (to avoid duplicating what exists): much of "god-mode" already ships (§6.15–6.17 admin + `activity_logs` mig 18); recurring/expiry have proven patterns (`jobs.expireDueTasks/expireDeals`, `task_templates/sendRecurring`); **Follow reverses the 2026-06-15 "will not implement" call** (flagged in §7.5); **Client History is blocked** — businesses don't transact tasks, so it needs a new `deal_redemptions` precursor. **Recorded in §7.11** with a priority table + drafts: (1) `follows` schema (polymorphic many-to-many, + two-table FK alternative) & follow API; (2) `campus_deals` recurrence columns + `jobs.refreshRecurringDeals()` (refresh-in-place); (3) `tasks.expires_at/archived_at` + `jobs.archiveExpiredTasks()`; (4) god-mode = **audit chokepoint (P1)** + full-CRUD admin endpoints over users/tasks/deals/businesses, every mutation append-logged to `activity_logs`. **Priorities:** P1 audit chokepoint + task TTL; P2 recurring specials, god-mode CRUD, follow graph; P3 Client History (blocked). Also refreshed the §1 architecture/data-model line (migrations 01–32, ~30 tables, scheduler design rule: query-time filter is authoritative). **No schema/code applied** — awaiting go-ahead; recommend building the P1 items first.
- **2026-06-23 — Campus Deals system BUILT + verified (§7.10 ✅):** Implemented the full 6-step build order. **DB:** migration `32_campus_deals.sql` (`campus_deals` with `business_owner_id`, `expires_at TIMESTAMPTZ`, `location_id`, `CHECK (expires_at > starts_at)`, partial index `WHERE status='active'`) — applied to Neon via `npm run migrate 32`. **Backend:** `routes/deals.js` mounted `/deals` — public `GET /deals` + `GET /deals/:id` enforce expiry at **query time** (`status='active' AND expires_at > NOW()`); ownership-gated `GET /deals/mine`, `POST`, `PATCH`, `DELETE` (business edits own only — `business_owner_id == req.userId`; admin any); `GET /deals/admin/all` for moderation. `jobs.expireDeals()` added to the scheduler (housekeeping). `/uploads/signature` gained a `deals` folder scope. **Frontend:** `DealCard`, `DealForm` (title/desc/price/image-upload/future-only expiry picker + presets + live preview), `BusinessDeals` dashboard tab, public `DealsPage` (`/deals` + nav, sends token if present so privileged roles can preview pre-launch), `AdminDeals` moderation page + nav; Vite `/deals` proxy. **Tests:** +20 → **backend 191** (incl. the critical expiry guard: active filter is in the SQL, and a past `expiresAt` is rejected 422 at create). **Verified in-browser** (local full-stack, `biz01@relivr.test`): create → owner list shows "Active · Ends in 2d 23h · R25"; public query returns it (authed); token-less public fetch → 503 (gate, as designed); `DealCard` live preview renders; test deal deleted after. **Decisions honoured:** public `/deals` **gated until 7 July** (businesses can post now — `business` role bypasses the gate). **Follow-ups:** campus filter chips on `/deals` (needs campus-id list; `useLocations` returns names only), deal view beacons/analytics.
- **2026-06-23 — PIVOT: Campus Deals system designed + integrated (§7.10):** Owner is pivoting the feature set to **Campus Deals** — businesses post time-limited "Limited Time Specials" (title/description/image/price/expiry); a public, campus-wide, responsive Deals page shows only active (un-expired) deals. **Four-persona design (no code yet):** *PM* — RBAC matrix (public read active; business CRUD own only; admin moderates any + owns static content). *Architect* — reuse existing infra (no new stack): new `campus_deals` table (migration 32) with `business_owner_id` + `expires_at TIMESTAMPTZ` + `location_id` (UUID, existing `locations` taxonomy); ownership-gated `routes/deals.js`; image upload via the existing Cloudinary signature endpoint; `expireDeals()` sweep added to `jobs.js`. *Security* — **expiry enforced at QUERY time** (`WHERE status='active' AND expires_at > NOW()` using the DB server clock — atomic, on every read, cannot be bypassed by client clock/cache/job failure); the background sweep is housekeeping only; partial index `WHERE status='active'`; `CHECK (expires_at > starts_at)`; express-validator future-date; ownership gate so no cross-tenant writes. *QA* — Vitest/Supertest plan incl. a critical test that a past-`expires_at` deal is absent from `GET /deals`. Full schema, retrieval SQL, API surface, UI/UX flow (Business Dashboard "Deals" tab + public `/deals` page + AdminDeals), tech stack, and a 6-step build order recorded in **§7.10**. **One open decision for owner:** is the public `/deals` page open pre-launch, or gated until 7 July? **No code changes this turn** — design + doc only; awaiting go-ahead to implement.
- **2026-06-23 — Business page-editor gallery rewritten to array state + VERIFIED in-browser (🐞 "deletes oldest on upload"):** Owner reported the business side still deleted the oldest image on upload (admin panel works perfectly). **Root cause:** the business `BusinessPageEditor` stored the gallery as a newline-joined **string** (`f.gallery` split/join) and the thumbnail-remove used a **stale closure** (`galleryArr()` captured at render, not the updater's `p`) — fragile vs. the admin `BusinessForm`, which uses a clean **array** and works. **Fix:** aligned business with admin — gallery is now a plain array; `addGalleryImage`/`removeGalleryImage` go through functional updaters (`p`); uploads append; the newline textarea was replaced with a paste-input + **Add** button (same control as admin); upload + paste now share one `addGalleryImage` path. **Verified live in a real browser** (ran frontend+backend locally, logged in as `biz01@relivr.test`): adding images went 2→3→4 with the **oldest always preserved**, and remove targeted the correct image. Nothing persisted (never clicked Save) so biz01's real data is intact. Frontend builds clean. Pushed (`42220ab`). **This supersedes the open clarification in the entry below — the business gallery now behaves like the admin panel.**
- **2026-06-23 — Fixed business-page live-preview hiding the gallery ("deletes oldest image" 🐞):** Owner reported that uploading an image "deletes the oldest image" + 503s in console. **Diagnosis (data layer is fine):** verified via prod API as `biz01@relivr.test` — `GET /businesses/mine`, `/notifications`, `/uploads/signature` all 200; a PATCH round-trip appending a 3rd image persisted all 3 with the oldest intact. So nothing is deleted server-side, and the frontend gallery handler appends (caps at 8, never drops). **Root cause:** `BusinessPreviewCard` rendered cover **OR** gallery (`cover ? cover : gallery`), so uploading a cover photo *hid* the gallery (incl. its first image) in the "how students see you" preview — read as "deleted the oldest." Also inconsistent with the public detail page (which shows cover **and** gallery). **Fix:** preview card now shows cover **and** gallery together (matches public page). **Re the 503s:** not a systematic block — a valid business token gets 200 everywhere; they're transient cold-Neon blips on the notifications poller (`requireAuth` token_version lookup → 503 on a cold connection), which the browser logs as a failed resource. Frontend builds clean. Pushed. **Open clarification:** confirming with owner whether their case was the cover-uploader (single-slot, replaces) vs the gallery (adds) — cover/logo are intentionally one-image slots.
- **2026-06-23 — Fixed prod CORS error on gated routes (🐞 real incident):** Owner reported `www.relivr.co.za` console flooded with "No 'Access-Control-Allow-Origin' header is present" on `/notifications`, `/uploads/signature`, etc. **Diagnosed via curl against prod:** OPTIONS preflight returned 204 *with* ACAO (so `www` is correctly allowed), but the **actual GET returned 503 with NO ACAO**. **Root cause:** the pre-launch gate middleware was registered *before* `cors()`, so a gated 503 was sent before any CORS header was set — the browser then reported a CORS error masking the real 503. (The earlier OPTIONS-bypass commit fixed only preflight, not the actual response.) **Fix:** moved the gate to run *after* `cors()` in `app.js` (kept a defensive OPTIONS short-circuit). No change to the origin allowlist — purely ordering. **Regression test:** new `server/test/launch-gate-cors.test.js` activates the gate (non-test env) and asserts the gated 503 carries `Access-Control-Allow-Origin` + that OPTIONS still answers 204 with CORS. **Backend 171 tests** (was 169). **Verified live on prod after redeploy:** anon `/notifications` → 503 *with* `access-control-allow-origin: https://www.relivr.co.za`; `biz01@relivr.test` → `/uploads/signature` → 200 (bypass intact). Note: this makes the 503 *readable* — non-bypassing users still get the launch gate (by design); business/admin/`@relivr.test` users bypass and work. **Product decision (owner, 2026-06-23):** keep the gate until **7 July 2026** — only business/admin (+`@relivr.test`) in pre-launch; regular users stay on the founding-member countdown by design. The CORS fix resolves the reported errors regardless. So "we have launched" = business onboarding is open, public marketplace opens 7 July.
- **2026-06-23 — Cloudinary uploads VERIFIED LIVE in prod + adopted §0.1 protocol:** Owner confirmed the `CLOUDINARY_*` vars are set in Railway. Ran a full end-to-end production check against `https://api.relivr.co.za` with a throwaway `@relivr.test` business account (gate-bypassing): **(1)** login → 200 + token; **(2)** `POST /uploads/signature` → 200, `cloud=dqqr8svsf`, folder correctly locked to the owner's business UUID, `allowed_formats=jpg,jpeg,png,webp,gif`, **preset `relivr_business` is live** (owner created it); **(3)** real upload to Cloudinary with a 1×1 test PNG → **200 + genuine `secure_url`** (proves the Railway creds are valid, not just present); **(4)** public GET of the `f_auto,q_auto` delivery URL → 200 `image/png`. The entire browser→Cloudinary→public chain works in production. Verification script was throwaway (deleted); it left one orphaned 1×1 px asset in the `biz01` test business's Cloudinary folder — harmless, not linked to any listing. Also **adopted the 5-role Autonomous Team Operating Protocol (§0.1)** at the owner's request (Product Manager / Architect / Lead Developer / QA Engineer / Security Officer; read-state-first; update this doc after every action; per-response Team Sync → Execution → QA/Security → State Update) and added a quick-glance status skeleton. No code changes this turn — feature was already committed (`386ef3b`/`9814d43`); this entry + §0.1 are the only diffs.
- **2026-06-22 — Cloudinary image uploads (business photos) BUILT + TESTED:** Businesses can now upload photos from their own device instead of pasting URLs. **Architecture:** signed, direct browser→Cloudinary uploads — the server never proxies image bytes. New `server/cloudinary.js` (env config + `isConfigured()` + `signParams()` via `node:crypto`, no SDK dependency) and `server/routes/uploads.js` → `POST /uploads/signature` (mounted in `app.js`). The endpoint is **auth-gated** (no anonymous signatures → no credit-burning) and **ownership-locked**: an owner's upload folder is derived server-side as `relivr/businesses/<their-business-id>` (they cannot target another business); admins may pass `businessId` or fall back to an `_admin` scratch folder for new listings; a path-injection `businessId` is rejected to the scratch folder. Returns 503 when Cloudinary env is unset (owners can still paste URLs). **Frontend** (`App.jsx`): new `ImageUpload` component (drag/drop + tap-to-pick, `accept="image/*"` so mobile offers camera OR library, 10 MB + JPG/PNG/WebP/GIF client pre-check, XHR progress) + `fetchUploadSignature`/`postToCloudinary` helpers; returned URLs get `f_auto,q_auto` injected (`optimizeCldUrl`) so every render site serves optimised images. Wired into **both** the owner `BusinessPageEditor` (cover/logo/gallery with thumbnail strips + remove) and the admin `BusinessForm` (logo + gallery). **Also fixed a latent gap:** `cover_image_url` was editable + shown in the owner's "how students see you" preview but was never returned by the public `GET /businesses` / `GET /businesses/:id` nor rendered on the public detail page — added it to both SELECTs and the public detail view (cover banner, then gallery). `/uploads` added to the Vite dev proxy. **Env:** `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` (+ optional `_UPLOAD_PRESET`) added to `env.js` OPTIONAL (warn, non-fatal) and `server/.env.example`. **Hardening (added):** `allowed_formats` (default `jpg,jpeg,png,webp,gif`, env `CLOUDINARY_ALLOWED_FORMATS`) is **signed into every upload**, so format is enforced by Cloudinary even without a preset and can't be widened by the client. Honest limit: a hard byte-size cap can't be signed onto a direct upload — size stays client-side (10 MB) + Cloudinary account/preset limit. **Tests:** new `server/test/uploads.test.js` (7) → **backend 169 tests** (was 162), all green; frontend builds clean. **Committed + pushed to `main` (`386ef3b`)** → Vercel/Railway redeploy. **NOT yet verified live end-to-end** (needs the owner's real Cloudinary creds in Railway). **To go live:** set `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` in Railway (the `_UPLOAD_PRESET` is now optional since format is signed). Without them, `/uploads/signature` 503s and owners can still paste URLs.
- **2026-06-21 — Payments foundation + monetisation/trust migrations + QA enablement + UI pass 1 + pitch decks (committed & pushed to `main`):** Large multi-thread session.
  - **DB migrations 23–30** (applied + idempotent on Neon): Paystack/ZAR escrow; business subscriptions (R750 setup + R75/mo); **Reliability Score** (`score_events` + `reliability_scores`); referrals/ambassadors; **multi-campus seed** (13 SA universities); B2B foundation (FMCG/credit/consent); POPIA compliance. (Migration 31 — `business` role + owner dashboard — is logged under 2026-06-19 below.)
  - **Paystack payments route** (`server/routes/payments.js`): initiate / verify / webhook (HMAC-SHA512) / release + business onboarding. `env.js` **warns (non-fatal)** on missing `PAYSTACK_SECRET_KEY`. This is the long-parked TD-3 / MVP-3 work starting to land (escrow still gated on company registration for go-live).
  - **`@relivr.test` accounts bypass the pre-launch gate** (server + client) so QA can exercise the full app pre-launch.
  - **Bug fixes (all real):** stale `frontend/.env VITE_API_URL=:8080` broke all dev API calls (emptied → Vite proxy); session-restore logged users out on any `/auth/me` hiccup (now only 401/403, hydrates from cache, clears malformed tokens); login's 5s timeout fell into a fake `demo-token` "demo mode" on cold-Neon starts (removed; timeout 25s).
  - **UI redesign pass 1:** design-token elevation/shadow scale; refined buttons/cards/inputs; **5 real brand photos** (Higgsfield `soul_2`, in `frontend/public/img/*.webp`) wired into the landing CampusStrip, a community CTA band, and the Local directory header.
  - **Pitch decks** (outside repo, in `<Documents>/`): `ReLivR_Pitch_Deck.pptx` (12-slide investor) + `ReLivR_Explainer_Deck.pptx` (11-slide explainer). Build scripts/assets in `<Documents>/relivr-deck/` (pptxgenjs; webp→jpg via Pillow; rendered via LibreOffice + PyMuPDF).
  - **Status:** backend **162 tests** / frontend **3** pass; builds clean. Latest commit `72ddfef`.
  - **Open follow-ups:** UI redesign **pass 2** (in-app surfaces — task/feed cards, dashboard, profile, messages, business dashboard styling; landing + shared components done); set `RESEND_API_KEY` + `PAYSTACK_SECRET_KEY` in Railway when ready; **launch-day 2026-07-07:** flip `beta_founder` default → FALSE + email the waitlist; clean the leftover "Campus Coffee Co"/"Test University" test records; deck placeholders to update (contact `hello@relivr.co.za`, ambassador URLs, the 10% commission figure, bull-case financials labelled as projections). Higgsfield: free plan ~9 credits left, video deferred. A couple of generated photos have faint AI signage artifacts (minor).
- **2026-06-19 — Business self-service dashboard + 30 QA logins DELIVERED:** Businesses were listing-only (admin-managed, no login). Added a full business-owner surface. **Schema** (migration 31, applied + idempotent on Neon): new `business` role (CHECK extended), `businesses.owner_id` + presentation fields (`tagline`, `theme_color`, `cover_image_url`, `socials`), and a privacy-clean `business_page_events` table (no IP/user_id — POPIA-safe). **Backend** (`routes/businesses.js`): ownership-gated `GET/PATCH /businesses/mine` (strict field whitelist — owners can never write `status`/`fee_paid`, no paywall bypass), `GET /businesses/mine/analytics` (views series + click totals + engagement), public rate-limited `POST /businesses/:id/events` beacon (active-only, coarse referrer host), admin `PATCH /businesses/:id/owner` (assign + promote to business role). +16 tests → **backend 162**. **Frontend** (`App.jsx`): role=`business` users get a self-contained `BusinessDashboard` (page editor + live preview + Analytics tab w/ reused `MiniChart`); `isAppLocked` + server gate now let business partners in pre-launch to onboard; public business view fires view/click beacons. **Seed**: `npm run seed:test-users` creates 10 business owners (each w/ a populated business + ~30d of analytics) + 20 students, idempotent, writing plaintext creds to `<Documents>/RELIVR_TEST_LOGINS.md` (OUTSIDE the repo — never committed). Emails use `@relivr.test`. **Two real bugs fixed while verifying live:** (1) stale `frontend/.env` `VITE_API_URL=http://localhost:8080` (retired gateway) made every `API_BASE` fetch hit a dead port → all dashboard/auth-me calls failed; emptied it so dev uses the Vite proxy. (2) session-restore cleared the token on ANY non-OK `/auth/me` (incl. transient cold-Neon 5xx/network) → silent logout on reload; now only clears on explicit 401/403, otherwise hydrates from cached `rl_user`. Also bumped the `/auth` proxy timeout 4s→20s and added a one-time auto-retry on the dashboard load. Verified live via preview: login→editor renders w/ live preview, edit tagline→Save persists to DB, Analytics shows 750 views/69 clicks/9.2% engagement + chart + contact breakdown. Frontend 3 tests still green. Committed + pushed to `main`. **Follow-ups:** business self-registration flow (currently admin-provisioned), business-side messaging, optional cleanup of the leftover `Test University` location.
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
