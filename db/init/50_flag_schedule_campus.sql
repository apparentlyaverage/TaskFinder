-- 50_flag_schedule_campus.sql — H2 completion: per-campus targeting + scheduled
-- enable/disable windows for feature_flags. Idempotent.
--
-- Builds on 39_flag_targeting (rollout_roles + rollout_percent):
--   • rollout_campuses — limit a flag to specific campuses (locations.kind='campus').
--                        NULL/empty = every campus. A viewer with no campus is
--                        excluded from a campus-targeted flag (same rule as %-rollout
--                        for anonymous viewers — we can't place them, so they're out).
--   • enable_at        — scheduled enable: the flag stays off until NOW() >= enable_at.
--   • disable_at       — scheduled kill: the flag auto-offs once NOW() >= disable_at.
-- Both windows are evaluated at resolution time (query-time authoritative — no job),
-- on top of the master `enabled` kill-switch which still overrides everything.

ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS rollout_campuses UUID[];
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS enable_at  TIMESTAMPTZ;
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS disable_at TIMESTAMPTZ;
