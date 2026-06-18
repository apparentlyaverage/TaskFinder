-- 11_email_prefs.sql — email notification preference (§7.4).
-- When TRUE, the user stops receiving ACTIVITY emails (new bid, award, review,
-- dispute, message). Security/transactional mail (password reset, email
-- verification) is always sent regardless. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
