-- 10_account_security.sql — per-account login lockout + soft-delete (§7.2).
--
--  • failed_login_attempts / locked_until: lock an account after repeated bad
--    passwords, independent of the per-IP rate limit (defends one account from
--    a distributed guessing attack).
--  • deleted_at: soft-delete / anonymisation marker for POPIA erasure — the row
--    is retained (anonymised) for referential integrity of tasks/reviews, but
--    the account can no longer authenticate.
-- Idempotent: safe to run on an existing database.

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ;
