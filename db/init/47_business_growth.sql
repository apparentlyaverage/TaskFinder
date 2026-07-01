-- 47_business_growth.sql — Phase 2 E3/E4/E5. Idempotent.
--   E3: public_code       — short, stable, shareable identifier (QR + links).
--   E4: boosted_until     — promoted-placement window (billing arrives with G1).
--   E5: disabled_features — admin switches specific capabilities off per business.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS public_code       VARCHAR(12);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS boosted_until     TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS disabled_features TEXT[] NOT NULL DEFAULT '{}';

-- Backfill a stable code for existing rows from the id (unique by construction).
UPDATE businesses SET public_code = upper(substr(replace(business_id::text, '-', ''), 1, 8))
 WHERE public_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_public_code ON businesses (public_code);
