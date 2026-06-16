-- 12_email_frequency.sql — notification email cadence (§7.4).
-- Supersedes the boolean email_opt_out (kept as a legacy column):
--   instant — email on each event (push via email)
--   daily   — no per-event mail; a scheduled digest batches new notifications
--   off     — no activity email (security mail still always sends)
-- last_digest_at gates the digest job to ~once per day. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_frequency VARCHAR(10) NOT NULL DEFAULT 'instant'
    CHECK (email_frequency IN ('instant', 'daily', 'off'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_at TIMESTAMPTZ;

-- Carry over anyone who had already opted out.
UPDATE users SET email_frequency = 'off' WHERE email_opt_out = TRUE AND email_frequency = 'instant';
