-- 37_known_logins.sql — remembers the devices a user has signed in from, so we
-- can email a "new sign-in" security alert when an unfamiliar device logs in.
-- Fingerprint = SHA-256 of the User-Agent (stable per browser/app, no raw PII).
-- The alert only fires for a NEW fingerprint on an account that already has a
-- known device — the very first sign-in records silently (no self-spam). Idempotent.

CREATE TABLE IF NOT EXISTS known_logins (
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    fingerprint CHAR(64) NOT NULL,                 -- sha256 hex of the user-agent
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_known_logins_user ON known_logins (user_id);
