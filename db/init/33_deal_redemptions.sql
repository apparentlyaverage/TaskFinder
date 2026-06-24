-- 33_deal_redemptions.sql — the business↔customer transaction record.
--
-- Powers the business "Client History" dashboard (§7.11.1). A logged-in student
-- redeems (claims) an active Campus Deal; that writes one row here, snapshotting
-- the deal's price at redemption time. Aggregating these per business gives the
-- owner their client base (unique customers, repeat rate, spend, timeline).
--
-- POPIA: the customer self-initiates the redemption (consent by action), so the
-- business may see who claimed their deal. customer_id is nullable + ON DELETE
-- SET NULL so a customer account deletion anonymises history without losing the
-- aggregate counts. Idempotent per repo convention.

CREATE TABLE IF NOT EXISTS deal_redemptions (
    redemption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id       UUID REFERENCES campus_deals(deal_id) ON DELETE SET NULL,
    business_id   UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    customer_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,
    amount_cents  INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),  -- ZAR, snapshot of deal price
    redeemed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Stored UTC calendar date backing the per-day uniqueness guard below. An
    -- expression index on (redeemed_at::date) is rejected by Postgres — that cast
    -- depends on the session timezone, so it isn't IMMUTABLE. A plain stored DATE
    -- (filled by a non-immutable DEFAULT at insert) indexes cleanly.
    redeemed_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'UTC')::date)
);

-- Client-history aggregation is always scoped to one business, newest first.
CREATE INDEX IF NOT EXISTS idx_redemptions_business ON deal_redemptions (business_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_customer ON deal_redemptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_deal     ON deal_redemptions (deal_id);

-- One redemption per customer per deal per calendar day: stops accidental
-- double-taps inflating a business's numbers, while still letting a customer
-- redeem a recurring/daily special again on a later day (true repeat custom).
CREATE UNIQUE INDEX IF NOT EXISTS uq_redemption_per_day
    ON deal_redemptions (deal_id, customer_id, redeemed_date)
    WHERE customer_id IS NOT NULL;
