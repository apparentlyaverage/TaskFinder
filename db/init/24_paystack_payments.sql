-- 24_paystack_payments.sql — replace Stripe escrow with Paystack (ZAR-native).
-- The original escrow_transactions table was built for Stripe (USD). This
-- migration adds Paystack columns to that table and creates a separate
-- paystack_transactions log (one row per Paystack API event). The Stripe
-- columns are kept (nullable) so existing rows are undisturbed; they can be
-- dropped post-launch once confirmed empty.
--
-- Escrow flow:
--   1. creator POSTs /payments/initiate  → paystack_ref created, status=pending
--   2. creator pays on Paystack checkout → webhook fires, status=funded
--   3. task completed (both sides)       → platform releases to earner, status=released
--   4. dispute raised                    → status=disputed, admin resolves

-- ── Extend escrow_transactions ────────────────────────────────────────────────
ALTER TABLE escrow_transactions
    ADD COLUMN IF NOT EXISTS paystack_ref        TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS paystack_transfer_id TEXT,
    ADD COLUMN IF NOT EXISTS currency_override   CHAR(3),   -- NULL = ZAR default
    ADD COLUMN IF NOT EXISTS amount_zar          NUMERIC(10,2);  -- human-readable ZAR

-- Default new rows to ZAR
ALTER TABLE escrow_transactions
    ALTER COLUMN currency SET DEFAULT 'zar';

-- amount_cents stays the canonical NOT NULL integer amount (for ZAR, cents ==
-- kobo, 100 = R1). The payments route populates both amount_cents and the
-- human-readable amount_zar mirror on every new escrow row.

-- ── Earner payout target ──────────────────────────────────────────────────────
-- A Paystack transfer recipient code is created once per earner (from their bank
-- details) and reused for every payout. Stored on the profile so
-- /payments/release can transfer the escrow balance to them.
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS paystack_recipient_code TEXT;

-- ── Paystack transaction log ──────────────────────────────────────────────────
-- One row per significant Paystack event (charge, transfer, refund, webhook).
-- Append-only — never updated.
CREATE TABLE IF NOT EXISTS paystack_transactions (
    pt_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id       UUID REFERENCES escrow_transactions(escrow_id) ON DELETE SET NULL,
    event_type      VARCHAR(60) NOT NULL,   -- 'charge.success', 'transfer.success', etc.
    paystack_ref    TEXT,
    amount_kobo     BIGINT,                 -- Paystack amounts are in kobo (100 kobo = R1)
    currency        CHAR(3) NOT NULL DEFAULT 'ZAR',
    channel         VARCHAR(30),            -- 'card', 'bank', 'ussd', etc.
    payload         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pt_escrow   ON paystack_transactions(escrow_id);
CREATE INDEX IF NOT EXISTS idx_pt_ref      ON paystack_transactions(paystack_ref);
CREATE INDEX IF NOT EXISTS idx_pt_created  ON paystack_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_type     ON paystack_transactions(event_type);
