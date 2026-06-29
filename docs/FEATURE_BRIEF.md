# ReLivR — Feature Brief & Build Prompt (DRAFT for review)

> Purpose: turn the raw feature list into a grouped, expanded, buildable brief.
> **This is a draft to review** — each ⚑ marks an assumption to confirm and 🆕 marks
> a point added on top of your list. Nothing here is built yet. Once you've reviewed,
> the condensed hand-off prompt at the very bottom is what gets executed (in phases).

## How to read each feature
- **What** — one-line definition.
- **Fit** — where it lands in the existing stack (migrations in `db/init`, query-time
  filters authoritative, `notify.js` for alerts, `jobs.js` scheduler, feature-flagged).
- **Notes** — key build/compliance considerations.
- **Done when** — acceptance check.

## Cross-cutting principles (apply to everything below)
- **Feature-flag every new surface** so it can ship dark and roll out per-campus/role (see Group H).
- **POPIA-first**: any new personal data (ID numbers, location, payment data, business
  KYC) needs a lawful basis, consent, minimisation, encryption at rest, retention rule,
  and a policy update. 🆕 Treat this as a gate on Groups A, D, E, G — not an afterthought.
- **Accessibility**: never signal with colour alone (affects task colour-coding); keyboard + SR support on new modals/flows. 🆕
- **Query-time enforcement**: visibility/expiry/eligibility decided at read time; schedulers are housekeeping only (matches current task-TTL/deals design).
- **Mobile-first**: these features assume the app becomes installable (Group H) — design for touch + push from the start.

---

## A. Identity, Verification & Onboarding
*Raises trust at the front door and teaches first-time users.*

### A1. ID verification at signup  *(your point)* — ✅ all users, via a provider
- **What:** every user verifies a national ID / passport during registration.
- **Fit:** register-flow step that calls a **third-party verification provider** (e.g. SmileID / DHA); persist only `id_verified` (pass/fail) + the provider's **reference token** on a `user_identity` table — **never the raw ID number**.
- **Notes:** ✅ **Decided:** required for **all** users, **provider-verified** so you verify *without* warehousing raw IDs. 🆕 **POPIA-critical:** explicit consent + stated purpose, encrypt any retained reference at rest, masked display only, retention/deletion rule, Privacy/POPIA update. Gate behind a flag + legal review before going live; have a graceful "verification pending/failed" state so a provider outage doesn't block signup entirely.
- **Done when:** every new user completes provider verification, only pass/fail + a reference is stored (no raw ID), and the privacy policy reflects it.

### A2. Student-discount QR system  *(your point #7 — reframed)* — ✅ claim → scan → discount
- **What:** verified students **claim a QR code** for a student-only discount; the **business scans it** to grant the discount. Student status, not full app-gating.
- **Fit:** student eligibility = verified institutional email (e.g. `@ru.ac.za`) via a **campus domain allowlist** table (like `locations` — new campus = a DB insert). The discount itself reuses the existing **`campus_deals` + `deal_redemptions`** model, with a `student_only` flag; the claimed QR encodes a **one-time redemption token**; a business-side **scanner** view marks it redeemed.
- **Notes:** 🆕 one-time / time-boxed tokens to prevent screenshot reuse; record each redemption (already modelled); show a **verified-student badge**; non-students simply can't claim student-only deals. **Shares the QR/scan core with E2** (opposite direction — see E2 note).
- **Done when:** a verified student claims a student-only deal as a QR, a business scans it once to redeem, and the redemption is recorded; non-verified users can't claim.

### A3. Signup walkthrough (slideshow/animation)  *(your point)*
- **What:** a short, skippable onboarding carousel after first signup ("post a task → get bids → handshake → done").
- **Fit:** new client-only component; persist `onboarding_seen` per user (DB flag or `localStorage`, prefer DB so it follows the account).
- **Notes:** 🆕 separate flows for **creator vs tasker vs business**; re-openable from Help; respect reduced-motion.
- **Done when:** first login shows it once, Skip works, it never re-nags, and it's re-launchable.

### A4. First-use feature coachmarks  *(your point — "notices for how features work when a user first presses on them")*
- **What:** contextual one-time tooltips the first time a user opens a feature (messages, handshake, bidding…).
- **Fit:** a `seen_feature_hints` store (array of hint keys per user); a small `<Coachmark id="…">` wrapper.
- **Notes:** 🆕 cap frequency (max 1 per session), always dismissible, never block the action.
- **Done when:** each tagged feature shows its hint once, then never again.

### A5. Request location data  *(your point)*
- **What:** ask for browser geolocation to sort/filter nearby tasks & businesses.
- **Fit:** `navigator.geolocation` with explicit prompt; fall back to the existing **campus zone** picker; sort `/businesses` and tasks by distance.
- **Notes:** 🆕 **POPIA** — location is personal info: ask consent, store **coarse** (zone/area) not precise coords unless needed, allow opt-out, document in policy. Tie into the cookie/consent model.
- **Done when:** with consent, nearby results sort by proximity; without it, the zone fallback works unchanged.

---

## B. Tasks: Cards, Lifecycle & Content
*The core marketplace object — simpler cards, richer lifecycle.*

### B1. Remove images from task cards  *(your point)*
- **What:** task cards become text + colour, no thumbnails.
- **Fit:** simplify the task-card component.
- **Notes:** 🆕 faster lists, far less moderation/upload burden, consistent visual rhythm — pairs with B2.
- **Done when:** task cards render with no image slot anywhere.

### B2. Colour-coded task cards  *(your point, listed twice)*
- **What:** colour each task card by a dimension.
- **Fit:** map a field to a token-based accent (left bar / tag tint).
- **Notes:** ✅ **Decided:** colour by **category** (each category → an accent token), plus a small status tag. 🆕 **A11y:** colour must be paired with a text label/icon — never colour alone. Define the category→colour map once and reuse it everywhere tasks render.
- **Done when:** every card shows its colour + matching label; legend documented.

### B3. Expected task duration  *(your point)*
- **What:** creator sets an estimate ("~2 hours", "half-day"); shown to bidders.
- **Fit:** `expected_duration` field on `tasks`; surfaced on card + detail; feeds scheduling (Group D).
- **Done when:** creators set it, bidders see it, it's optional but prominent.

### B4. Bidding deadline  *(your point)*
- **What:** a cut-off after which no new bids are accepted.
- **Fit:** `bids_close_at` on `tasks`; **enforced at query/insert time** (reject late bids), housekeeping job just flags display state.
- **Notes:** 🆕 notify the creator at close; relates to B5 (lifetime) and B6 (cancellation).
- **Done when:** bids are blocked after the deadline server-side; UI shows a countdown.

### B5. Task lifetime extension  *(your point)*
- **What:** let creators extend a task's live window before it auto-expires.
- **Fit:** builds on the existing **task-TTL** (migration 34); add an "extend" action that pushes `expires_at`.
- **Notes:** 🆕 cap number/length of extensions; log extensions; auto-archive on final expiry.
- **Done when:** a creator extends an expiring task and it stays live; abuse caps enforced.

### B6. Task cancellation  *(your point)*
- **What:** a defined cancel flow with states and consequences.
- **Fit:** new task status transitions (`open → cancelled`, `awarded → cancelled`); reason capture; notifications via `notify.js`.
- **Notes:** 🆕 **who can cancel when** (creator pre-award freely; post-award needs mutual/handshake — Group C); **escrow refund** rules (Group G); **dispute** interplay; abuse limits + cancellation-rate on trust score.
- **Done when:** both parties can cancel within rules, funds resolve correctly, and both are notified.

### B7. Bad-language / content filter  *(your point)*
- **What:** filter profanity/abuse across user-generated content.
- **Fit:** a shared `cleanText()`/moderation util applied to **tasks, bids, messages, reviews, business copy**; 🆕 normalise leetspeak/spacing; SA-multilingual word list; severity levels (mask vs block vs flag-for-review).
- **Notes:** 🆕 pair with a **moderation queue** (added cross-cutting item) and an appeals path; log hits, don't silently shadow-ban.
- **Done when:** flagged content is masked/blocked consistently and surfaced to admins.

---

## C. Deals Between Users: Handshakes & Collaboration
*Make the agreement and the work itself first-class on-platform.*

### C1. Handshake to confirm a price / price change  *(your point, listed twice)*
- **What:** a two-party confirmation that locks an agreed price (and re-locks on any change).
- **Fit:** a `handshakes` (or `agreements`) table = a small **state machine**: `proposed → countered → agreed` (or `declined`), each transition signed by a user + timestamp = an immutable audit trail.
- **Notes:** 🆕 a price-change opens a **new handshake** that both must accept; ties directly into escrow (C2) and disputes. Carries quasi-contractual weight → log everything.
- **Done when:** both parties must accept before a task is "agreed"; any change requires a fresh mutual accept; history is auditable.

### C2. On-platform agreement syncs to the agreed price  *(your point — "handshakes on platform to the new agreed on platform")*
- **What:** when a handshake agrees a (new) price, the on-platform record/escrow amount updates to match.
- **Fit:** the agreed handshake amount becomes the **source of truth** for the escrow/payment intent (Group G).
- **Notes:** 🆕 prevents off-platform renegotiation drift; the escrow can only move to a handshake-agreed figure.
- **Done when:** escrow/charge amount always equals the latest agreed handshake; no silent edits.

### C3. In-depth task management between two users  *(your point)*
- **What:** a shared workspace per awarded task — milestones, status, deliverable submission, accept/request-changes.
- **Fit:** **extends what already exists** (the notify catalog already has *work submitted / changes requested / completed*); add structured milestones + a status timeline to the task-detail/messages view.
- **Notes:** 🆕 a clear state machine (`awarded → in_progress → submitted → (changes_requested ↔ submitted) → completed`); deliverable attachments; this is the spine disputes hang off.
- **Done when:** two users can run a task from award to completion with visible status, submissions, and change requests.

---

## D. Scheduling & Calendar
*Time-aware tasks and bookable businesses.*

### D1. Scheduling for taskers & creators  *(your point, listed twice)* — ✅ full availability calendars
- **What:** users keep a **personal availability calendar**; others book free slots within it.
- **Fit:** an `availability` (recurring + one-off blocks) + `bookings` model; SAST timezone; **conflict detection** (no double-booking); ICS export. Feeds off expected-duration (B3) to size slots.
- **Notes:** ✅ **Decided:** full availability calendars (not just per-task agreed times) — the bigger build, so design the schema + conflict logic up front; this same core powers business appointments (D2).
- **Done when:** a user maintains availability, another books a free slot, double-booking is prevented, and both calendars + reminders update.

### D2. Scheduling / appointments for businesses  *(your point)*
- **What:** businesses publish bookable slots; students book.
- **Fit:** business-side availability + a booking object; reuses D1 primitives; ties to business profile (Group E).
- **Notes:** 🆕 capacity per slot, cancellations, reminders; overlaps strongly with D1 — build the calendar core once.
- **Done when:** a business defines slots and a student books one with confirmation + reminder.

### D3. Calendar / task event notifications  *(your point)*
- **What:** reminders for upcoming agreed times and bookings.
- **Fit:** `jobs.js` scheduled scan → `notify.js` (in-app + email per `email_frequency`); push once Group H lands.
- **Done when:** users get a reminder ahead of scheduled events on their chosen channel.

---

## E. Businesses (B2B)
*Deepen the Instagram-style business presence into a real merchant surface.*

### E1. Business reviews / ratings  *(your point — "business reviews can also be reviews")*
- **What:** businesses can be rated/reviewed like users.
- **Fit:** extend the existing 5-star **reviews** model to accept a `business` target (alongside user targets); show aggregate on the IG profile (Group built this session).
- **Notes:** ✅ **Decided:** **anyone** can review a business. 🆕 Because it's open, lean harder on the content filter (B7), the moderation queue, and **rate-limit / one-review-per-user-per-business** to curb spam & fakes; feeds ranking/boost (E4).
- **Done when:** eligible users leave a star+text review on a business; it shows on the profile and affects its rating.

### E2. QR codes for businesses  *(your point)*
- **What:** a per-business QR that links to its ReLivR profile / a deal.
- **Fit:** generate from the business's **unique identifier** (E3); deep-links to `/b/<handle>` or a deal-redeem URL.
- **Notes:** 🆕 in-store → scan → follow / redeem; track scans as a `business_page_events` type for analytics. **Two QR directions to support:** E2 = *business shows, student scans* (open profile/deal); A2 = *student shows, business scans* (claim a student-only discount). Build **one shared QR-generate + scanner core** for both.
- **Done when:** a business can display a QR that opens its profile/deal and the scan is attributed.

### E3. Unique business identifiers / handles  *(your point)*
- **What:** a stable public handle + short code per business (e.g. `relivr.co.za/b/bean-there`).
- **Fit:** `slug` + short `public_code` on `businesses`; underpins QR (E2), deal-redemption codes, and shareable links.
- **Notes:** 🆕 immutable code for QR even if the display name changes; uniqueness + profanity check on slugs.
- **Done when:** every business has a unique handle/code used by links, QR, and redemptions.

### E4. Marketing boost (promoted listings)  *(your point)*
- **What:** paid promotion — featured placement in the `/local` grid + search.
- **Fit:** a `boost` record (paid via Group G) that weights ranking for a window; **"Promoted" label** for disclosure.
- **Notes:** 🆕 must be clearly labelled (consumer-protection); boost analytics; fair rotation so it's not pay-to-monopolise.
- **Done when:** a paid boost surfaces a business higher with a visible "Promoted" tag for its window.

### E5. Disable / toggle business features  *(your point)*
- **What:** turn specific business capabilities on/off.
- **Fit:** two layers — **global** via the feature-flags system (Group H) and **per-business** admin toggles (e.g. suspend a business's deals or boost).
- **Notes:** 🆕 distinguish "feature not enabled for this tier" vs "admin-suspended for abuse."
- **Done when:** an admin can disable a feature globally or for one business and the UI reflects it.

---

## F. Following, Retainers & Loyalty
*Turn follows into recurring relationships.*

### F1. Saved/favourited providers + retainers  *(your point)* — ✅ both
- **What:** two tiers on top of follows — (1) **save/favourite** a provider for quick re-hiring; (2) **retainer** = a recurring *paid* engagement with a provider (e.g. weekly tutoring, monthly cleaning).
- **Fit:** favourites = a light flag/list on **follows** (migration 35), ships with no payments. Retainers build on the **recurring** primitives (migration 36) + payments (Group G) — a recurring agreement that auto-creates the task + charge on schedule.
- **Notes:** 🆕 **favourites can ship early**; **retainers wait on G1** (company registration). Retainers need cancellation, reminders, and a clear next-occurrence view; reuse the handshake (C1) to set the recurring price.
- **Done when:** users can favourite providers now; and (post-payments) start a cancellable recurring paid engagement that auto-creates tasks/charges on schedule.

### F2. Deal notifications  *(your point)*
- **What:** alert followers when a followed business posts a deal / when a deal is about to expire.
- **Fit:** `notify.js` on deal create + a `jobs.js` "expiring soon" scan; respects `email_frequency`; push via Group H.
- **Done when:** followers are notified of new + expiring deals on their chosen channel.

---

## G. Payments
*The money rails that unlock escrow, retainers, boosts, and deal payments.*

### G1. Dual payment integration  *(your point)*
- **What:** support two providers (card + EFT), e.g. **Paystack + Ozow** (already the roadmap direction).
- **Fit:** a **provider-abstraction layer** (common interface: charge / verify / refund / webhook) so providers are pluggable; escrow ledger; webhook signature verification (the Paystack raw-body hook already exists).
- **Notes:** 🆕 **PCI/POPIA** — never store card data (tokenise via provider); reconciliation + idempotency keys; failover / method selection; fees handling; payout flow. ✅ **Confirmed parked** on company registration — but build the provider-abstraction so it's drop-in ready.
- **Done when:** a user can pay via either provider into escrow, funds release on completion, and refunds work on cancellation.

---

## H. Platform, App & Infrastructure
*The enablers the rest depend on.*

### H1. Convert to a downloadable app  *(your point)*
- **What:** make ReLivR installable.
- **Fit:** 🆕 **PWA first** (web app manifest + service worker + installable + offline shell + **push notifications**) — fastest path given the React/Vite app; **native wrapper (Capacitor) later** if app-store presence is needed.
- **Notes:** PWA push is the prerequisite that makes Groups D3/F2 "real" notifications, not just email.
- **Done when:** users can "Add to Home Screen", the app opens standalone, and push notifications deliver.

### H2. Expand feature flags  *(your point)*
- **What:** grow the existing admin **Feature Flags** from simple on/off into a rollout system.
- **Fit:** the `feature_flags` table + admin UI already exist — extend with: **per-role**, **per-campus**, **% rollout / cohort**, **kill-switches**, **scheduled enable**, and an **audit log** of changes.
- **Notes:** 🆕 this is what lets every feature above ship dark and roll out safely to Rhodes first, then nationally.
- **Done when:** a flag can target a role/campus/percentage, be scheduled, killed instantly, and its changes are audited.

### H3. Change the messaging icon  *(your point)*
- **What:** the current messages glyph (`◎`) reads as generic — swap for a clear chat/speech-bubble icon.
- **Fit:** trivial UI change in the top nav + sidebar; keep it consistent in both.
- **Done when:** messages uses a recognisable speech-bubble icon everywhere.

---

## I. Legal & Compliance
*Keep the policy ahead of the product.*

### I1. Update policies to cater for businesses  *(your point)*
- **What:** the current Terms/Privacy/POPIA are consumer-centric — add the B2B side.
- **Fit:** add a **Merchant/Business Agreement** (obligations, deal & redemption terms, **marketing-boost terms**, review policy, payment/payout & fees, suspension grounds) and extend Privacy to cover business data + reviews + analytics.
- **Notes:** 🆕 ties to ID (A1), location (A5), payments (G1) — all need policy coverage. Owner to get the SA attorney review already flagged.
- **Done when:** businesses accept a merchant agreement at onboarding and the policies cover all new data uses.

---

## 🆕 Cross-cutting items added (not on your list, but needed)
- **Moderation queue** — admin surface for flagged content (B7), business reviews (E1), and boost/marketing copy.
- **Accessibility pass** — colour-coding (B2), new modals (handshake, lightbox, onboarding) must be keyboard/SR friendly.
- **Notification preferences expansion** — per-type opt-in/out (deals, calendar, handshakes) layered on the existing `email_frequency`.
- **Analytics/metrics** — track adoption of each new feature (esp. boost, retainers, scheduling) to justify the roadmap.
- **Audit trails** — handshakes (C1), flag changes (H2), cancellations (B6), ID/verification events all need logs.

## Dependencies & suggested sequencing
1. **Foundations first:** H2 (feature flags) → so everything else ships dark. H1 PWA shell (unlocks push).
2. **Trust & onboarding:** A2 student verify, A3 walkthrough, A4 coachmarks, H3 icon (low-risk, high-visibility). A1 ID **after** legal review.
3. **Task core:** B1/B2 cards, B3 duration, B4 bidding deadline, B5 lifetime, B6 cancellation, B7 filter.
4. **Collaboration:** C1–C3 handshakes + task management (these gate cancellation refunds & disputes).
5. **Scheduling:** D1 → D2 → D3 (build the calendar core once).
6. **Business depth:** E3 handles → E2 QR → E1 reviews → E4 boost → E5 toggles.
7. **Money + recurring:** G1 dual payments → F1 **retainers** + E4 boost charging (parked on company registration). *(F1 **favourites** ship earlier — no payments needed.)*
8. **Always alongside:** I1 policies, moderation queue, analytics, a11y.

## ✅ Decisions (locked 2026-06-30)
1. **ID (A1):** required for **all** users, via a **verification provider** (store pass/fail + reference, never raw IDs).
2. **Colour-coding (B2):** by **category**.
3. **Retainers (F1):** **both** — save/favourite providers *and* recurring paid retainers.
4. **Scheduling (D1):** **full availability calendars**.
5. **Business reviews (E1):** **anyone** can review.
6. **Payments (G1):** **stays parked** until company registration.
7. **Student (A2):** **a student-discount QR system** — verified students claim a QR, businesses scan to grant student-only discounts (no broad app-gating).

---

## ✅ The hand-off prompt (condensed — review this, then it gets executed in phases)

> Build the following onto ReLivR (Express + Neon backend, React/Vite single-file
> frontend; idempotent `db/init` migrations; query-time filters authoritative;
> `notify.js` alerts; `jobs.js` scheduler). **Feature-flag every item** (extend the
> existing flags system) and ship behind flags, Rhodes-first. **POPIA-gate** anything
> touching new personal data (ID numbers, location, payments, business KYC) — consent,
> encryption at rest, minimisation, retention, and policy updates are part of "done".
> Never signal with colour alone.
>
> **A. Identity & onboarding:** ID verification for **all** users via a **provider** (store
> pass/fail + reference, never raw IDs; flag + legal review first); a **student-discount QR
> system** (verified students claim a QR, businesses scan to grant student-only discounts —
> reuses `campus_deals`/`deal_redemptions`); skippable signup walkthrough; first-use
> coachmarks; consented location for nearby sorting.
> **B. Tasks:** drop images from cards; colour-code cards **by category** (with text labels); expected
> duration; bidding deadline (server-enforced); task lifetime extension (on the TTL);
> task cancellation flow (refund/dispute aware); bad-language filter across all UGC.
> **C. Handshakes:** a two-party price-agreement state machine (re-confirm on change) that
> drives the on-platform escrow amount; structured two-user task management
> (milestones/status/deliverables) extending the existing submit/changes flow.
> **D. Scheduling:** full **availability calendars** for taskers/creators + bookable business
> slots on one calendar core; conflict detection; event reminders via notify/jobs (+push).
> **E. Businesses:** unique handles/codes → QR codes → business reviews → marketing boost
> (labelled "Promoted") → global+per-business feature toggles.
> **F. Following:** **save/favourite** providers (ships early) + **retainers** (recurring
> *paid* engagements, post-payments); deal notifications (new + expiring) to followers.
> **G. Payments:** provider-abstraction supporting two providers (Paystack + Ozow) with
> escrow, webhooks, refunds — parked on company registration.
> **H. Platform:** PWA (installable + push), expanded feature flags (role/campus/%/
> scheduled/kill-switch/audit), new messaging icon.
> **I. Legal:** add a business/merchant agreement and extend Privacy/POPIA for business
> data, reviews, ID, location, and payments.
> **Plus:** moderation queue, notification-preference expansion, analytics on adoption,
> audit trails, and an accessibility pass.
>
> Deliver in the dependency order above. Each feature: migration (if needed) + backend
> route + tests + frontend + flag + docs/policy update, verified locally against Neon.
