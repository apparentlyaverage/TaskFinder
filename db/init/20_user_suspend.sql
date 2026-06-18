-- 20_user_suspend.sql — admin user moderation (§7.8).
-- A suspended account keeps its data (unlike deletion) but can't sign in.
-- Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
