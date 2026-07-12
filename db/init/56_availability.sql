-- 56_availability.sql — Batch 4: real-time availability (presence + working hours). Idempotent.
--
-- Two independent "available now" signals power the Available-Now rail:
--   • ONLINE  — users.last_seen_at is bumped by requireAuth (best-effort, throttled
--               in-process to ~1/min). A user is "online" if seen in the last 5 min.
--   • OPEN NOW — user_profiles.working_hours declares a recurring weekly window
--               ({days:[1..7 ISO], start:"HH:MM", end:"HH:MM"}); "open now" is
--               computed in SAST (Africa/Johannesburg — SA-only platform, no DST).
-- available_for_work is the provider's master opt-in: nobody appears in the rail
-- unless they've turned it on (so presence is never broadcast without consent).

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Partial index: the online lookup only ever scans rows that have a heartbeat.
CREATE INDEX IF NOT EXISTS idx_users_last_seen
    ON users (last_seen_at) WHERE last_seen_at IS NOT NULL;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS available_for_work BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS working_hours JSONB;
