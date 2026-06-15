# Legacy — Retired Backend (do not deploy)

**Retired 2026-06-15 (Sprint 1 / MVP-1).** Ratified decision: ReLivR ships as the
single Express monolith in [`/server`](../server). These directories are kept for
reference and history only.

## What's here

- **`gateway/`** — the old API gateway. Trusted a spoofable `x-user-id` header to
  identify the caller; the monolith replaced this with JWT verification in
  `server/middleware.js`.
- **`services/`** — the 7 standalone microservices (`auth`, `tasks`, `payments`,
  `messaging`, `matching`, `reviews`, `disputes`). Their logic was merged into
  `server/routes/*`. The RabbitMQ event bus they used was replaced by direct
  `server/notify.js` calls.

## Why retired

- Operational overhead far exceeds MVP needs (one team, pre-launch).
- The gateway's header-trust model was a security liability.
- `docker-compose.yml` previously built **these** services, not the live monolith —
  meaning the documented deploy path shipped dead, insecure code. Fixed in MVP-1.

## Do not

- Wire these back into `docker-compose.yml`.
- Copy the `x-user-id` trust pattern into new code.

If horizontal scale ever demands a split, re-extract from the *current* `server/`
code, not from these snapshots.
