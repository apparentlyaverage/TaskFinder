-- 22_beta_launch.sql — beta-launch support (§6.18). Idempotent.

-- Persistent "founding member" marker. DEFAULT TRUE during the beta so every
-- new signup is a founder; flip the default to FALSE at launch:
--   ALTER TABLE users ALTER COLUMN beta_founder SET DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_founder BOOLEAN NOT NULL DEFAULT TRUE;
-- Backfill anyone who joined before launch.
UPDATE users SET beta_founder = TRUE WHERE created_at < '2026-07-07';

-- Launch-reminder waitlist (visitors who aren't registered yet).
CREATE TABLE IF NOT EXISTS waitlist (
    waitlist_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    want_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Beta feedback submissions.
CREATE TABLE IF NOT EXISTS feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(120),
    email       VARCHAR(255),
    message     TEXT NOT NULL,
    user_id     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
