-- 23_businesses_schema.sql — local business listings (founding-partner track).
-- The businesses route and admin UI have been live for several sessions but the
-- CREATE TABLE was never committed to db/init. This file makes it idempotent
-- and part of the reproducible schema so a fresh Neon branch or staging env can
-- be stood up with a single `npm run migrate`.
CREATE TABLE IF NOT EXISTS businesses (
    business_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(160) NOT NULL,
    category     VARCHAR(60)  NOT NULL,
    description  TEXT,
    address      TEXT,
    map_hint     TEXT,
    phone        VARCHAR(30),
    whatsapp     VARCHAR(30),
    email        VARCHAR(160),
    hours        VARCHAR(200),
    image_urls   TEXT[]  NOT NULL DEFAULT '{}',
    logo_url     TEXT,
    link_url     TEXT,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','expired','suspended')),
    -- Onboarding fee tracking (R750 one-time)
    fee_paid     NUMERIC(10,2),
    paid_at      TIMESTAMPTZ,
    signed_by_rep VARCHAR(120),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_status   ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_businesses_updated_at'
  ) THEN
    CREATE TRIGGER trg_businesses_updated_at
      BEFORE UPDATE ON businesses
      FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;
