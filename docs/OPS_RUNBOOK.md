# ReLivR — Ops Runbook

Operational procedures for running ReLivR in production. See also
[`SECURITY_RUNBOOK.md`](./SECURITY_RUNBOOK.md) for secret rotation.

---

## Database backup & restore (Neon)

The Postgres database is hosted on **Neon**. Neon's primary safety net is
**Point-in-Time Restore (PITR)** plus cheap **branching** — prefer these over
manual dumps for recovery.

### 1. Point-in-Time Restore (accidental data loss / bad migration)
1. Neon console → your project → **Branches** → the branch backing production
   (usually `main`/`production`).
2. **Restore** → pick a timestamp *before* the incident (Neon retains history
   per your plan's restore window — verify it covers your RPO).
3. Neon restores the branch to that moment. The connection string is unchanged,
   so the app reconnects automatically. Confirm with `GET /health`.

> Test this in staging at least once so the steps are muscle memory before a
> real incident.

### 2. Restore via a branch (non-destructive investigation)
Create a branch from a past timestamp to inspect old data *without* touching
production:
1. Neon console → **Branches** → **Create branch** → "from a point in time".
2. Point a throwaway `DATABASE_URL` at the branch and query it.
3. Copy the needed rows back, or promote the branch if it should become prod.

### 3. Manual logical backup (offsite / migration / belt-and-suspenders)
Neon PITR doesn't protect against losing the Neon account itself — keep periodic
offsite dumps for anything you can't afford to lose.
```bash
# Full logical dump (schema + data)
pg_dump "$DATABASE_URL" -Fc -f relivr-$(date +%F).dump

# Restore into another Postgres
pg_restore --no-owner --clean --if-exists -d "$TARGET_DATABASE_URL" relivr-YYYY-MM-DD.dump

# Schema only (e.g. to diff against db/init/*.sql)
pg_dump "$DATABASE_URL" --schema-only -f schema.sql
```
Store dumps encrypted, off Neon (e.g. an object store with lifecycle expiry).
A weekly cron is a reasonable starting cadence; tighten to match your RPO.

### Recovery targets to agree on
- **RPO** (max acceptable data loss): bounded by Neon's restore window + dump
  cadence. Pick a dump cadence ≤ your RPO.
- **RTO** (max acceptable downtime): PITR/branch restore is minutes; a full
  `pg_restore` from a dump scales with DB size — rehearse it.

---

## Schema migrations
Migrations live in `db/init/*.sql` and are applied with `npm run migrate`
(`server/scripts/migrate.mjs`). They are idempotent (`IF NOT EXISTS`, guarded
`ALTER`s). Always run them against a Neon **branch** first, verify, then prod.

## Promoting an admin
`cd server && npm run make-admin <email>` (the user signs out/in to refresh
their token). There is no UI for this by design.

## Feature flags
Flip runtime behaviour without a deploy: Admin → Feature Flags (or
`PATCH /admin/flags/:key {"enabled":true|false}`). The frontend reads enabled
flags from `GET /flags`.
