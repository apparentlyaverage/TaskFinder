-- 30_popia_compliance.sql — POPIA data subject rights infrastructure.
-- South Africa's Protection of Personal Information Act (POPIA) gives data
-- subjects the right to: access their data, correct it, delete it ("erasure"),
-- and receive it in a portable format. This migration adds the tables needed to
-- log, track, and fulfill those requests within the required 30-day window.
--
-- Also adds popia_consent tracking to users (distinct from B2B consents in
-- data_consent_events, which are purpose-specific and optional). The baseline
-- POPIA consent gates onboarding and is mandatory.

-- ── Ensure popia_consent column exists on users ───────────────────────────────
-- This column records whether the user explicitly accepted the Privacy Policy
-- at registration. popia_consent already added in an earlier session; this is
-- a no-op if it exists.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS popia_consent        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS popia_consent_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS popia_consent_version VARCHAR(10);  -- policy version e.g. '1.0'

-- ── Data subject request log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS popia_requests (
    request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(user_id) ON DELETE SET NULL,
    -- user_id may be NULL for requests from users who already deleted their account
    email         TEXT NOT NULL,              -- always capture email for comms
    request_type  VARCHAR(20) NOT NULL
                      CHECK (request_type IN ('access','erasure','correction','portability','objection')),
    -- access      → send the user a copy of all their data
    -- erasure     → delete all PII (soft or hard depending on legal hold)
    -- correction  → update incorrect personal data
    -- portability → export data in machine-readable format (JSON/CSV)
    -- objection   → cease specific processing activities
    status        VARCHAR(20) NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','in_progress','completed','rejected','on_hold')),
    rejection_reason TEXT,                    -- if rejected, must state lawful basis
    notes         TEXT,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    completed_at  TIMESTAMPTZ,
    -- Who handled it (admin user_id)
    handled_by    UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_user      ON popia_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pr_status    ON popia_requests(status);
CREATE INDEX IF NOT EXISTS idx_pr_due       ON popia_requests(due_at);
CREATE INDEX IF NOT EXISTS idx_pr_received  ON popia_requests(received_at DESC);

-- ── Data processing audit log ─────────────────────────────────────────────────
-- Append-only record of what personal data was processed, when, and why.
-- Supports demonstrating POPIA compliance to the Information Regulator.
CREATE TABLE IF NOT EXISTS popia_processing_log (
    log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(user_id) ON DELETE SET NULL,
    activity      VARCHAR(80) NOT NULL,
    -- e.g. 'profile_viewed', 'data_exported', 'account_deleted', 'b2b_data_shared'
    lawful_basis  VARCHAR(40) NOT NULL
                      CHECK (lawful_basis IN (
                          'consent',          -- user gave explicit consent
                          'contract',         -- necessary to perform contract
                          'legal_obligation', -- required by law
                          'vital_interests',  -- protect life
                          'public_interest',  -- official authority
                          'legitimate_interest' -- platform's legitimate interest
                      )),
    purpose       TEXT NOT NULL,
    data_classes  TEXT[] NOT NULL DEFAULT '{}',
    -- e.g. ARRAY['name','email','location','financial']
    performed_by  UUID REFERENCES users(user_id) ON DELETE SET NULL,  -- admin or system
    request_id    UUID REFERENCES popia_requests(request_id) ON DELETE SET NULL,
    metadata      JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppl_user    ON popia_processing_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ppl_created ON popia_processing_log(created_at DESC);

-- ── Information Regulator notification log ────────────────────────────────────
-- POPIA s.22 requires notifying the Regulator of security compromises.
CREATE TABLE IF NOT EXISTS popia_breach_log (
    breach_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discovered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description    TEXT NOT NULL,
    affected_count INTEGER,
    data_classes   TEXT[] NOT NULL DEFAULT '{}',
    reported_to_regulator_at TIMESTAMPTZ,
    notified_users_at TIMESTAMPTZ,
    status         VARCHAR(20) NOT NULL DEFAULT 'investigating'
                       CHECK (status IN ('investigating','contained','reported','closed')),
    handled_by     UUID REFERENCES users(user_id) ON DELETE SET NULL
);
