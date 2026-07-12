-- 57_business_products.sql — Batch 5: business product/service catalogs. Idempotent.
--
-- A business owner lists what they sell — products or services — each with an
-- optional price (ZAR cents; NULL = "price on request"), a photo, an availability
-- toggle, and a manual sort order. Public GETs power the catalog on the business
-- profile; writes are owner-scoped (owner_id = the caller) in businesses.js.

CREATE TABLE IF NOT EXISTS business_products (
    product_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL,
    description  VARCHAR(600),
    price_cents  INTEGER CHECK (price_cents IS NULL OR price_cents >= 0), -- NULL = POA / "from"
    image_url    TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ordered listing per business (owner catalog + public menu both read this way).
CREATE INDEX IF NOT EXISTS idx_products_business
    ON business_products (business_id, sort_order, created_at);
