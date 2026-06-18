-- 21_feature_flags.sql — runtime feature toggles (§7.8). Idempotent.
-- Admins flip flags without a deploy; the frontend reads enabled flags via
-- GET /flags and the server can gate behaviour on them.

CREATE TABLE IF NOT EXISTS feature_flags (
    flag_key    VARCHAR(60) PRIMARY KEY,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (flag_key, enabled, description) VALUES
  ('local_directory',  TRUE,  'Show the Local businesses directory'),
  ('recurring_tasks',  TRUE,  'Allow recurring task templates'),
  ('universal_search', TRUE,  'Enable the people/businesses/tasks search bar')
ON CONFLICT (flag_key) DO NOTHING;
