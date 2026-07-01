-- 48_business_reviews.sql — Phase 2 E1: ratings + reviews for businesses. Idempotent.
-- Anyone can review a business (decision locked 2026-06-30); one review per person
-- per business (a UNIQUE index — re-submitting updates via upsert in the route).
-- Kept separate from the user `reviews` table so the trust-score / task-review logic
-- is untouched. Aggregates (avg + count) are computed at read time from here.

CREATE TABLE IF NOT EXISTS business_reviews (
    review_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     VARCHAR(2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_reviews_biz ON business_reviews (business_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_review_per_user ON business_reviews (business_id, reviewer_id);
