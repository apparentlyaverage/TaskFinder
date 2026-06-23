-- 32_campus_deals.sql — "Campus Deals": time-limited specials posted by businesses.
--
-- A business owner posts a "Limited Time Special" (title/description/image/price)
-- with an expiry. A public, campus-wide Deals page shows only ACTIVE deals.
--
-- SAFETY MODEL (the important bit): "active" is enforced at QUERY time with
--   WHERE status = 'active' AND expires_at > NOW()
-- using the database server clock — atomic, evaluated on every read, and
-- impossible to bypass from the client. The background sweep that flips
-- status -> 'expired' (server/jobs.js expireDeals) is housekeeping only;
-- correctness never depends on it.
--
-- Reuses existing infra: businesses(owner_id) + the 'business' role for RBAC,
-- the UUID locations taxonomy for campus scope, and Cloudinary for image_url.
-- Idempotent (IF NOT EXISTS) per the repo convention — applied by hand / the
-- migrate runner; no migration framework.

CREATE TABLE IF NOT EXISTS campus_deals (
    deal_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id          UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    -- Denormalised from businesses.owner_id (set server-side at create) so every
    -- ownership check is a single-column compare, mirroring the dashboard model.
    business_owner_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- Optional campus scope. NULL = visible on every campus. Reuses the existing
    -- UUID locations taxonomy (migration 07/28).
    location_id          UUID REFERENCES locations(location_id) ON DELETE SET NULL,
    title                VARCHAR(120) NOT NULL,
    description          TEXT,
    image_url            TEXT,
    price_cents          INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),          -- ZAR cents
    original_price_cents INTEGER CHECK (original_price_cents IS NULL OR original_price_cents >= 0),
    status               VARCHAR(16) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('draft','active','expired','archived')),
    starts_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at           TIMESTAMPTZ NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_deal_window CHECK (expires_at > starts_at)
);

-- Hot path: the public page lists active, unexpired deals ordered soonest-ending.
-- A PARTIAL index (only live rows) keeps it small and serves the ORDER BY.
CREATE INDEX IF NOT EXISTS idx_deals_live     ON campus_deals (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_deals_owner    ON campus_deals (business_owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_business ON campus_deals (business_id);
CREATE INDEX IF NOT EXISTS idx_deals_location ON campus_deals (location_id);
