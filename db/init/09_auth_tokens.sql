-- 09_auth_tokens.sql — single-use tokens for password reset + email verification.
--
-- Tokens are stored HASHED (sha256) — a database leak must not expose usable
-- reset/verify links. The raw token only ever exists in the email we send.
-- Idempotent: safe to run on an existing database.

CREATE TABLE IF NOT EXISTS auth_tokens (
    token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    purpose     VARCHAR(20) NOT NULL CHECK (purpose IN ('password_reset', 'email_verify')),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
