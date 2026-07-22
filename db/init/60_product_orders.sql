-- 60_product_orders.sql — catalogue orders (pay-on-collection). Idempotent.
--
-- A viewer browsing a business's public catalogue can place an ORDER for an item
-- (business_products). This is a reservation/order record, NOT a card payment:
-- payment is arranged directly with the business (cash/EFT on collection). The
-- unit price is snapshotted at order time so later catalogue edits don't rewrite
-- history; total_cents is unit_price_cents * quantity (both NULL for POA items,
-- which are ordered as an enquiry with the price agreed on collection).
--
-- Lifecycle: pending → accepted → ready → completed, or → cancelled (by either
-- side). The buyer may cancel only while pending; the business owner drives the
-- rest.

CREATE TABLE IF NOT EXISTS product_orders (
    order_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES business_products(product_id) ON DELETE CASCADE,
    business_id      UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    buyer_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 999),
    unit_price_cents INTEGER CHECK (unit_price_cents IS NULL OR unit_price_cents >= 0), -- snapshot; NULL = POA
    total_cents      INTEGER CHECK (total_cents IS NULL OR total_cents >= 0),
    note             VARCHAR(500),   -- buyer's note (size, collection time, etc.)
    contact_phone    VARCHAR(30),    -- how the business reaches the buyer
    fulfilment       VARCHAR(20) NOT NULL DEFAULT 'collection'
        CHECK (fulfilment IN ('collection')),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'ready', 'completed', 'cancelled')),
    cancelled_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Owner inbox: newest orders for a business, filterable by status.
CREATE INDEX IF NOT EXISTS idx_orders_business ON product_orders (business_id, created_at DESC);
-- Buyer history: newest orders a buyer placed.
CREATE INDEX IF NOT EXISTS idx_orders_buyer    ON product_orders (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product  ON product_orders (product_id);

-- Reuse the shared updated_at trigger function (defined in 01_users_schema.sql).
DROP TRIGGER IF EXISTS trg_product_orders_updated_at ON product_orders;
CREATE TRIGGER trg_product_orders_updated_at BEFORE UPDATE ON product_orders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
