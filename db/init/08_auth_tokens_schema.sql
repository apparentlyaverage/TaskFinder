-- 08_auth_tokens_schema.sql — JWT revocation support (TD-5).
--
-- Stateless JWTs can't be invalidated before they expire, so a leaked 7-day
-- token stayed valid for 7 days and "logout" only cleared the client. This adds
-- a per-user token_version: it is embedded in every issued JWT and checked on
-- each authenticated request. Bumping it (logout / password change) instantly
-- invalidates every token previously issued to that user.
--
-- Idempotent: safe to run on an existing database.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
