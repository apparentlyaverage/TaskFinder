-- 07_locations_schema.sql — scalable, data-driven location taxonomy.
--
-- Purpose: remove the Rhodes-only hard-coding so ReLivR can expand campus-by-
-- campus and eventually nationwide WITHOUT a code change — adding a campus or a
-- zone becomes an INSERT, not a redeploy. Hierarchy is generic:
--   region (province/city)  ─┐
--   campus                   ├─ parent_id chain
--   zone (residence/area)   ─┘
-- Location is OPTIONAL and never gates who can join.
--
-- Idempotent: safe to run on an existing database (there is no migration
-- runner; per the repo convention, db/init/*.sql are applied in order by hand
-- or by the Postgres entrypoint on first boot).

CREATE TABLE IF NOT EXISTS locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    kind        VARCHAR(20) NOT NULL CHECK (kind IN ('region','campus','zone')),
    parent_id   UUID REFERENCES locations(location_id) ON DELETE CASCADE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- A name is unique within its parent (NULL parent = top-level). This is the
-- conflict target that makes the seed below idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_parent_name
    ON locations (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

CREATE INDEX IF NOT EXISTS idx_locations_kind   ON locations(kind);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);

-- Optional, non-gating link from a profile to a location. Kept alongside the
-- existing free-text user_profiles.campus_zone (which stays as the denormalised
-- display value) so nothing downstream breaks.
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(location_id) ON DELETE SET NULL;

-- ── Seed: Rhodes University + its zones (launch campus) ──────────────────────
-- Explicit existence checks (rather than ON CONFLICT inference) keep this
-- re-runnable without depending on the exact unique-index expression.
DO $$
DECLARE
    rhodes_id UUID;
    z TEXT;
    i INTEGER := 0;
    zones TEXT[] := ARRAY[
        'West Campus','East Campus','Drostdy','Allan Webb','Founders',
        'Goldfields','Hobson','Kimberley','Botha','Dingane',
        'Adamson','Cory','Jan Smuts','Oriel','Prince Alfred',
        'Off-campus / Town','Other'
    ];
BEGIN
    SELECT location_id INTO rhodes_id
    FROM locations WHERE lower(name) = lower('Rhodes University') AND kind = 'campus';

    IF rhodes_id IS NULL THEN
        INSERT INTO locations (name, kind, parent_id, sort_order)
        VALUES ('Rhodes University', 'campus', NULL, 0)
        RETURNING location_id INTO rhodes_id;
    END IF;

    FOREACH z IN ARRAY zones LOOP
        IF NOT EXISTS (
            SELECT 1 FROM locations WHERE parent_id = rhodes_id AND lower(name) = lower(z)
        ) THEN
            INSERT INTO locations (name, kind, parent_id, sort_order)
            VALUES (z, 'zone', rhodes_id, i);
        END IF;
        i := i + 1;
    END LOOP;
END $$;
