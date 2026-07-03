-- 51_onboarding.sql — user onboarding (intent + completion marker). Idempotent DDL.
--
--   • intent       — what the user said they're here for at signup ('post' tasks,
--                    'earn' money, or 'both'). Tailors the walkthrough and future
--                    defaults; nullable (skippable question).
--   • onboarded_at — when the user completed the onboarding questions. NULL means
--                    the app should offer the onboarding step (chiefly new Google
--                    users, whose OAuth signup can't ask anything). Email
--                    registrations complete onboarding inside the signup modal, so
--                    /auth/register stamps it directly.
--
-- The backfill marks all pre-existing profiles as onboarded — they predate the
-- flow and must not be nagged. (One-time: re-running only touches rows that are
-- still NULL, which after the feature ships are exactly the users we WANT to
-- re-prompt; run this file once, per repo convention.)

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS intent TEXT
    CHECK (intent IN ('post','earn','both'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

UPDATE user_profiles SET onboarded_at = NOW() WHERE onboarded_at IS NULL;
