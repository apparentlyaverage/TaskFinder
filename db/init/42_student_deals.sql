-- 42_student_deals.sql — Phase 2 A2: student-only deals + QR claim/redeem. Idempotent.
--
-- Flow: a (verified-student, for student_only deals) customer CLAIMS a deal → gets a
-- one-time token rendered as a QR. The business SCANS/enters that token to redeem,
-- which records a normal deal_redemption (so Client History is unchanged) and marks
-- the claim spent. "Verified student" = a verified email whose domain is in the
-- campus allowlist below (same data-driven pattern as locations).

ALTER TABLE campus_deals ADD COLUMN IF NOT EXISTS student_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Campus email domains that qualify a user as a verified student.
CREATE TABLE IF NOT EXISTS student_domains (
    domain VARCHAR(120) PRIMARY KEY,
    label  VARCHAR(120)
);
INSERT INTO student_domains (domain, label) VALUES
  ('ru.ac.za',    'Rhodes University'),
  ('relivr.test', 'ReLivR QA')
ON CONFLICT (domain) DO NOTHING;

-- A student's claim of a deal → the one-time QR token a business redeems.
CREATE TABLE IF NOT EXISTS deal_claims (
    claim_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id     UUID NOT NULL REFERENCES campus_deals(deal_id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token       VARCHAR(24) NOT NULL UNIQUE,
    status      VARCHAR(12) NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','redeemed')),
    claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_deal_claims_token ON deal_claims (token);
CREATE INDEX IF NOT EXISTS idx_deal_claims_user  ON deal_claims (user_id);
-- At most one live (unredeemed) claim per user per deal — re-claiming returns it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_claim_active ON deal_claims (deal_id, user_id) WHERE status = 'claimed';
