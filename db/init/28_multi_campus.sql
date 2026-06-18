-- 28_multi_campus.sql — seed South African campuses for multi-campus expansion.
-- Playbook Phase 1 (M13-24): diversify beyond Rhodes to reduce single-campus
-- concentration risk and unlock the FMCG partnership tier (requires reach across
-- multiple campuses).
--
-- IMPORTANT: this works WITH the existing locations hierarchy from
-- 07_locations_schema.sql, where each campus is a row with kind='campus'
-- (Rhodes is already seeded there as a top-level campus). We add a stable `slug`
-- natural key plus optional geo columns, then insert the remaining universities
-- as kind='campus' rows, inactive until they are formally launched.

-- ── Supplementary columns on the existing locations table ─────────────────────
-- (region/city are modelled by the hierarchy's parent chain, not flat columns,
--  so we only add a slug key and coordinates here.)
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS slug      TEXT,
    ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

-- A FULL unique index (not partial) so slug can be a foreign-key target below.
-- Multiple NULL slugs are allowed by Postgres under a unique index, so existing
-- zone/region rows without a slug are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_slug ON locations(slug);

-- Tag the already-seeded Rhodes campus with its slug + coordinates.
UPDATE locations
   SET slug = 'rhodes', latitude = -33.3037, longitude = 26.5233
 WHERE lower(name) = lower('Rhodes University')
   AND kind = 'campus'
   AND slug IS NULL;

-- ── Seed the remaining universities as inactive campuses ──────────────────────
-- kind='campus', parent_id=NULL (top-level, same as Rhodes), is_active=FALSE
-- until each campus is formally launched. Idempotent: only inserts a slug that
-- is not already present.
INSERT INTO locations (name, kind, parent_id, is_active, sort_order, slug, latitude, longitude)
SELECT v.name, 'campus', NULL, FALSE, v.sort_order, v.slug, v.lat, v.lng
FROM (VALUES
  ('Nelson Mandela University',               10, 'nmu',  -33.918400, 25.567200),
  ('University of Cape Town',                  11, 'uct',  -33.957000, 18.461200),
  ('Stellenbosch University',                  12, 'sun',  -33.932600, 18.864400),
  ('Cape Peninsula University of Technology',  13, 'cput', -33.929600, 18.627900),
  ('University of the Witwatersrand',          14, 'wits', -26.192900, 28.030500),
  ('University of Johannesburg',               15, 'uj',   -26.185100, 27.999600),
  ('University of Pretoria',                   16, 'up',   -25.754500, 28.231400),
  ('Tshwane University of Technology',         17, 'tut',  -25.731200, 28.161400),
  ('University of KwaZulu-Natal',              18, 'ukzn', -29.867700, 30.980000),
  ('Durban University of Technology',          19, 'dut',  -29.859300, 31.019500),
  ('University of the Free State',             20, 'ufs',  -29.105200, 26.190700),
  ('University of Limpopo',                    21, 'ul',   -23.882300, 29.742100),
  ('North-West University',                    22, 'nwu',  -25.848800, 25.646600)
) AS v(name, sort_order, slug, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM locations l WHERE l.slug = v.slug);

-- ── Campus expansion tracking ─────────────────────────────────────────────────
-- Tracks when each campus was formally onboarded (marketing, ambassador placed,
-- first task posted). Used in the admin dashboard to measure expansion velocity.
CREATE TABLE IF NOT EXISTS campus_expansions (
    expansion_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_slug TEXT NOT NULL REFERENCES locations(slug) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned','ambassador_placed','soft_launch','live')),
    ambassador_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    planned_at    DATE,
    launched_at   TIMESTAMPTZ,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_campus_exp ON campus_expansions(location_slug);

-- Mark Rhodes as already live.
INSERT INTO campus_expansions (location_slug, status, launched_at)
VALUES ('rhodes', 'live', NOW())
ON CONFLICT (location_slug) DO NOTHING;
