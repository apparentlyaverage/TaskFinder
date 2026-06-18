-- 29_b2b_foundation.sql — B2B data monetisation scaffold.
-- Playbook Phase 1-2 (M13-24): FMCG first client M14, Gig Network partnerships,
-- Credit API M18-19. This schema separates B2B clients from the public business
-- directory and enforces consent before any user data is shared externally.
--
-- Data flow:
--   b2b_clients → data_api_keys (one key per integration)
--   data_api_keys → data_consent_events (user-level grant/revoke log)
--   Credit API route checks: reliability_scores.lender_eligible = TRUE
--                             AND data_consent_events has active consent for that client

-- ── B2B client registry ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS b2b_clients (
    client_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    category      VARCHAR(40) NOT NULL
                      CHECK (category IN ('fmcg','lender','insurer','recruiter','research','other')),
    contact_email TEXT NOT NULL,
    contact_name  TEXT,
    contract_url  TEXT,                         -- signed agreement on file (Dropbox/Drive URL)
    data_tier     VARCHAR(20) NOT NULL DEFAULT 'aggregate'
                      CHECK (data_tier IN ('aggregate','anonymised','identified','credit_api')),
    -- aggregate  = only cohort-level stats (no user PII)
    -- anonymised = pseudonymous user signals (no name/email)
    -- identified = full profile (requires explicit user consent)
    -- credit_api = lender-grade reliability score (requires lender_eligible flag)
    monthly_fee   NUMERIC(10,2),                -- R/month for data access
    status        VARCHAR(20) NOT NULL DEFAULT 'prospect'
                      CHECK (status IN ('prospect','trial','active','suspended','churned')),
    activated_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_status   ON b2b_clients(status);
CREATE INDEX IF NOT EXISTS idx_b2b_category ON b2b_clients(category);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_b2b_updated_at'
  ) THEN
    CREATE TRIGGER trg_b2b_updated_at
      BEFORE UPDATE ON b2b_clients
      FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

-- ── API keys per integration ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_api_keys (
    key_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     UUID NOT NULL REFERENCES b2b_clients(client_id) ON DELETE CASCADE,
    key_hash      TEXT NOT NULL UNIQUE,   -- bcrypt hash of the actual key; never store plaintext
    label         TEXT,                   -- e.g. 'production', 'staging'
    scopes        TEXT[] NOT NULL DEFAULT '{}',
    -- Possible scopes: 'aggregate_stats', 'anonymised_signals', 'user_profile', 'credit_score'
    last_used_at  TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ,
    revoked       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dak_client ON data_api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_dak_hash   ON data_api_keys(key_hash);

-- ── Per-user consent ledger ────────────────────────────────────────────────────
-- POPIA s.11 requires purpose-specific, informed consent. Each row is an
-- immutable event; the current consent state is the most recent row per
-- (user_id, client_id, purpose).
CREATE TABLE IF NOT EXISTS data_consent_events (
    consent_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    client_id     UUID NOT NULL REFERENCES b2b_clients(client_id) ON DELETE CASCADE,
    purpose       VARCHAR(60) NOT NULL,   -- mirrors data_tier: 'aggregate','anonymised','identified','credit_api'
    action        VARCHAR(10) NOT NULL CHECK (action IN ('grant','revoke')),
    ip_address    TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dce_user    ON data_consent_events(user_id);
CREATE INDEX IF NOT EXISTS idx_dce_client  ON data_consent_events(client_id);
CREATE INDEX IF NOT EXISTS idx_dce_created ON data_consent_events(created_at DESC);

-- Convenience view: current active consent per user+client+purpose
CREATE OR REPLACE VIEW active_consents AS
SELECT DISTINCT ON (user_id, client_id, purpose)
    user_id, client_id, purpose, action, created_at
FROM data_consent_events
ORDER BY user_id, client_id, purpose, created_at DESC;

-- ── FMCG campaign ledger ───────────────────────────────────────────────────────
-- FMCG clients run targeted micro-campaigns (e.g. survey + reward). Each
-- campaign has a budget pool; earners opt-in; payouts are tracked here.
CREATE TABLE IF NOT EXISTS fmcg_campaigns (
    campaign_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     UUID NOT NULL REFERENCES b2b_clients(client_id) ON DELETE CASCADE,
    title         TEXT NOT NULL,
    description   TEXT,
    reward_per_user NUMERIC(10,2),        -- cash reward per qualifying user
    budget_total  NUMERIC(10,2),
    budget_spent  NUMERIC(10,2) NOT NULL DEFAULT 0,
    target_count  INTEGER,                -- max users to recruit
    enrolled_count INTEGER NOT NULL DEFAULT 0,
    campus_filter TEXT[],                 -- NULL = all campuses
    status        VARCHAR(20) NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','active','paused','completed','cancelled')),
    starts_at     TIMESTAMPTZ,
    ends_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fmcg_enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id   UUID NOT NULL REFERENCES fmcg_campaigns(campaign_id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'enrolled'
                      CHECK (status IN ('enrolled','completed','paid','disqualified')),
    completed_at  TIMESTAMPTZ,
    reward_paid   BOOLEAN NOT NULL DEFAULT FALSE,
    paystack_ref  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fe_campaign ON fmcg_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fe_user     ON fmcg_enrollments(user_id);
