-- 39_flag_targeting.sql — feature-flag targeting (Phase 1, H2). Idempotent.
--
-- Grows the simple on/off feature_flags into a rollout system:
--   • rollout_roles   — limit a flag to specific roles (NULL/empty = everyone).
--   • rollout_percent — gradual rollout 0–100, bucketed deterministically per
--                       user (hash(user_id+flag_key)), so a given user is stably
--                       in or out as the % climbs.
-- The master kill-switch stays `enabled`; change history is already captured by
-- the existing admin audit log (activity_logs via writeAudit), so no new table.

ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS rollout_roles   TEXT[];
ALTER TABLE feature_flags ADD COLUMN IF NOT EXISTS rollout_percent SMALLINT NOT NULL DEFAULT 100;
