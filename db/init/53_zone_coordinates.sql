-- 53_zone_coordinates.sql — replace the meaningless placeholder ring from
-- 52_geolocation.sql with real, best-effort approximate coordinates for the 17
-- Rhodes zones in Makhanda (Grahamstown), Eastern Cape. Idempotent.
--
-- 52 seeded every zone on an ALPHABETICAL ring (angle = sort order) around a
-- campus point that was itself ~900 m too far north — so the proximity sort
-- was comparing device position to fictitious positions. This corrects both:
--   • the campus centroid → the real Rhodes core (~-33.3120, 26.5200);
--   • each zone → a hand-placed approximation. Campus residences cluster tightly
--     on the real campus core (Rhodes is ~1 km across, so within-campus everything
--     genuinely IS close); "Off-campus / Town" sits in the Makhanda town centre
--     (~800 m ESE); West/East Campus and the western residences (Prince Alfred,
--     Goldfields, Allan Webb, Oriel) vs eastern ones (Drostdy, Kimberley, Adamson)
--     are offset in the right direction.
--
-- These are APPROXIMATIONS, not surveyed coordinates — good enough for coarse
-- same-campus sorting, and any zone is refinable in Admin → Locations without a
-- redeploy. The guards below only overwrite values still inside 52's placeholder
-- ring (a small box around the old campus point), so an admin correction made
-- after this migration is never clobbered, and re-running is a no-op.

-- Placeholder box: the old campus point (-33.3037, 26.5233) ± the 0.003° ring.
-- Real Makhanda coordinates fall well south of this, so once applied they leave
-- the box and won't be touched again.

-- 1) Correct the campus centroid (guarded to the exact stale seed value).
UPDATE locations
   SET latitude = -33.3120, longitude = 26.5200
 WHERE lower(name) = lower('Rhodes University') AND kind = 'campus'
   AND latitude = -33.3037 AND longitude = 26.5233;

-- 2) Real approximate zone coordinates.
WITH rhodes AS (
    SELECT location_id FROM locations WHERE lower(name) = lower('Rhodes University') AND kind = 'campus'
),
coords(zone, lat, lng) AS (VALUES
    ('West Campus',       -33.3123::numeric, 26.5175::numeric),
    ('East Campus',       -33.3112, 26.5232),
    ('Drostdy',           -33.3114, 26.5228),
    ('Allan Webb',        -33.3130, 26.5188),
    ('Founders',          -33.3121, 26.5205),
    ('Goldfields',        -33.3127, 26.5182),
    ('Hobson',            -33.3117, 26.5212),
    ('Kimberley',         -33.3113, 26.5216),
    ('Botha',             -33.3125, 26.5196),
    ('Dingane',           -33.3128, 26.5200),
    ('Adamson',           -33.3119, 26.5220),
    ('Cory',              -33.3103, 26.5205),
    ('Jan Smuts',         -33.3122, 26.5210),
    ('Oriel',             -33.3118, 26.5190),
    ('Prince Alfred',     -33.3126, 26.5192),
    ('Off-campus / Town', -33.3105, 26.5285),
    ('Other',             -33.3120, 26.5200)
)
UPDATE locations l
   SET latitude = c.lat, longitude = c.lng
  FROM coords c, rhodes
 WHERE l.parent_id = rhodes.location_id
   AND l.kind = 'zone'
   AND lower(l.name) = lower(c.zone)
   -- only overwrite a still-placeholder value (inside 52's ring box)
   AND l.latitude  BETWEEN -33.3067 AND -33.3007
   AND l.longitude BETWEEN  26.5203 AND  26.5263;
