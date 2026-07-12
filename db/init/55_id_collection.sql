-- 55_id_collection.sql — SA ID number collection (epic batch 3). Idempotent.
--
-- POPIA-sensitive PII. Design:
--   • id_number_enc  — AES-256-GCM ciphertext (base64 iv:tag:ct), key held ONLY
--     in the ID_ENCRYPTION_KEY env var (never in the DB or repo). Without the
--     key a DB dump alone cannot recover a single ID number.
--   • id_number_hash — SHA-256 of (server pepper + normalised ID). Deterministic,
--     so a UNIQUE index enforces one-account-per-ID (anti-abuse / duplicate
--     detection) without ever decrypting anything.
-- Minimisation: we deliberately store NO derived columns (DOB, gender, etc.).
-- The application refuses to log or echo the raw number anywhere.
--
-- Owner note (recorded in the session log): storage was explicitly approved
-- by the owner with POPIA attorney review still pending on their side.

ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number_enc  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_id_number_hash
    ON users (id_number_hash) WHERE id_number_hash IS NOT NULL;
