-- 25_business_subscriptions.sql — track R750 onboarding + R75/month maintenance.
-- Separates the financial subscription record from the business listing record so
-- billing state can be queried and automated independently of the directory data.

CREATE TABLE IF NOT EXISTS business_subscriptions (
    sub_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    -- Onboarding (one-time, R750)
    onboarding_fee   NUMERIC(10,2) NOT NULL DEFAULT 750.00,
    onboarding_paid  BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_ref   TEXT,                   -- Paystack reference for the R750 charge
    onboarding_at    TIMESTAMPTZ,
    -- Monthly maintenance (R75/month)
    maintenance_fee  NUMERIC(10,2) NOT NULL DEFAULT 75.00,
    billing_anchor   DATE,                   -- day-of-month billing resets to
    next_billing_at  TIMESTAMPTZ,
    last_billed_at   TIMESTAMPTZ,
    -- Status mirrors business status for quick queries
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','active','overdue','cancelled')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_biz_sub ON business_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_sub_status   ON business_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_sub_next_bill ON business_subscriptions(next_billing_at);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_biz_sub_updated_at'
  ) THEN
    CREATE TRIGGER trg_biz_sub_updated_at
      BEFORE UPDATE ON business_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

-- Monthly billing history — one row per charge attempt
CREATE TABLE IF NOT EXISTS subscription_payments (
    sp_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_id        UUID NOT NULL REFERENCES business_subscriptions(sub_id) ON DELETE CASCADE,
    amount        NUMERIC(10,2) NOT NULL,
    paystack_ref  TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','success','failed','refunded')),
    billing_period DATE NOT NULL,           -- first day of the month this covers
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sp_sub_id  ON subscription_payments(sub_id);
CREATE INDEX IF NOT EXISTS idx_sp_created ON subscription_payments(created_at DESC);
