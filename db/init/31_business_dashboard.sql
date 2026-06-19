-- 31_business_dashboard.sql — business self-service dashboard + page analytics.
--
-- Until now businesses were listing-only: admins/reps created and managed them
-- and businesses did not log in (see routes/businesses.js header). This migration
-- introduces business-OWNER accounts so a business can manage its own page and
-- see its analytics:
--   • a 'business' user role
--   • businesses.owner_id linking a listing to the user who manages it
--   • presentation fields the owner can edit (tagline, theme, cover, socials)
--   • a privacy-clean page-event log powering the analytics tab
--
-- Authorisation model: the backend authorises by OWNERSHIP (owner_id == caller),
-- not by role alone. The role exists so the frontend can route a business user
-- to the dashboard. Owners can never edit status/fees (admin-only) — no paywall
-- bypass.

-- ── 1. Allow the 'business' role ──────────────────────────────────────────────
-- The live CHECK is ('member','creator','earner','admin'); extend it. Done in a
-- DO block so it is idempotent and resilient to the auto-generated constraint name.
DO $$
DECLARE cname TEXT;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'users'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('member','creator','earner','admin','business'));
END $$;

-- ── 2. Owner link + editable presentation fields ─────────────────────────────
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS owner_id        UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tagline         VARCHAR(200),
    ADD COLUMN IF NOT EXISTS theme_color     VARCHAR(9),    -- hex e.g. #1E90FF
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS socials         JSONB NOT NULL DEFAULT '{}';  -- {instagram, facebook, tiktok, twitter, website}

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);

-- ── 3. Page analytics (privacy-clean: no IP, no user_id) ─────────────────────
-- One row per tracked interaction on a public business page. We deliberately
-- store NO personal data — only the business, the event type, and a coarse
-- referrer host — so this needs no POPIA consent and cannot identify a viewer.
CREATE TABLE IF NOT EXISTS business_page_events (
    event_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
    event_type    VARCHAR(30) NOT NULL
                      CHECK (event_type IN (
                          'view',             -- page opened
                          'phone_click',      -- tapped the phone number
                          'whatsapp_click',   -- tapped WhatsApp
                          'email_click',      -- tapped email
                          'link_click',       -- tapped the website/link
                          'directions_click', -- tapped address/map
                          'image_view'        -- opened a gallery image
                      )),
    referrer_host TEXT,                       -- coarse source only, never a full URL with params
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bpe_business_created ON business_page_events(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bpe_type            ON business_page_events(event_type);
