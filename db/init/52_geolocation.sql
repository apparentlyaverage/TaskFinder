-- 52_geolocation.sql — Phase 2 A5: request location data (proximity sort).
-- Idempotent.
--
-- Design: distance is computed CLIENT-SIDE. The browser asks the user for
-- device geolocation (explicit consent action — a button press, never
-- automatic), rounds it to a coarse ~100m precision, and compares it against
-- PUBLIC zone centroids already served by GET /locations. The user's device
-- coordinates never reach our server — nothing to store, nothing to leak, and
-- no new consent-model plumbing needed. This is the strongest form of the
-- brief's "store coarse not precise, allow opt-out" requirement: we store
-- nothing at all.
--
-- What businesses/tasks need is a ZONE to compare against:
--   • tasks already have a free-text campus_zone column (added by the app
--     pre-dating db/init coverage — see the schema-drift note in
--     docs/DEVELOPER_ONBOARDING.md). No column change needed there.
--   • businesses have never had a zone. Add an optional location_id FK,
--     mirroring the existing user_profiles.location_id pattern (07_locations_schema.sql).

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(location_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_location ON businesses(location_id);

-- Backfill APPROXIMATE centroids for the 17 Rhodes zones (they only ever got a
-- campus-level centroid from 28_multi_campus.sql; the individual residences/
-- areas were never geocoded). These are a deterministic ring around the real
-- Rhodes campus point (-33.3037, 26.5233), radius ~0.003° (~300m) — NOT
-- surveyed coordinates. They're placeholders good enough for coarse
-- same-campus sorting; refine via Admin → Locations (lat/lng are editable
-- there without a redeploy) once real coordinates are available.
-- WHERE latitude IS NULL makes this idempotent AND non-destructive: re-running
-- never clobbers a value an admin has since corrected.
WITH rhodes AS (
    SELECT location_id FROM locations WHERE lower(name) = lower('Rhodes University') AND kind = 'campus'
),
ring AS (
    SELECT z.location_id,
           row_number() OVER (ORDER BY z.sort_order, z.name) - 1 AS idx,
           count(*) OVER () AS n
      FROM locations z, rhodes
     WHERE z.parent_id = rhodes.location_id AND z.kind = 'zone' AND z.latitude IS NULL
)
UPDATE locations l
   SET latitude  = -33.3037 + 0.003 * sin(2 * pi() * ring.idx / ring.n),
       longitude = 26.5233  + 0.003 * cos(2 * pi() * ring.idx / ring.n)
  FROM ring
 WHERE l.location_id = ring.location_id;
