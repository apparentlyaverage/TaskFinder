-- 14_categories.sql — data-driven marketplace categories (§7.5).
-- Mirrors the locations pattern: the category list (icon, gradient, keywords for
-- cover-art inference) lives in the DB so adding a category is an INSERT, not a
-- frontend deploy. Seeded from the previously hard-coded CATEGORIES. Idempotent.

CREATE TABLE IF NOT EXISTS categories (
    category_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL UNIQUE,
    icon          TEXT,
    gradient_from TEXT,
    gradient_to   TEXT,
    keywords      TEXT[],
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, icon, gradient_from, gradient_to, keywords, sort_order) VALUES
  ('Tech & Coding',   '💻', '#ede9fe', '#c4b5fd', ARRAY['python','react','node','javascript','debug','api','postgres','sql','database','mobile','firebase','etl','machine','rest'], 0),
  ('Tutoring',        '📚', '#fef3c7', '#fcd34d', ARRAY['tutor','math','lesson','teach','study','exam'], 1),
  ('Errands',         '🛵', '#dcfce7', '#86efac', ARRAY['laundry','delivery','errand','pickup','shopping','collect'], 2),
  ('Design',          '🎨', '#fce7f3', '#f9a8d4', ARRAY['design','figma','ui','ux','logo','poster'], 3),
  ('Writing',         '✍️', '#e0f2fe', '#7dd3fc', ARRAY['writing','editing','proofread','essay','translat','lang','transcrib'], 4),
  ('Music & Arts',    '🎸', '#fee2e2', '#fca5a5', ARRAY['music','guitar','piano','art','photo'], 5),
  ('Moving & Labour', '📦', '#ffedd5', '#fdba74', ARRAY['moving','furniture','labour','clean','garden'], 6),
  ('Other',           '✨', '#f3f1ec', '#ddd8cb', ARRAY[]::TEXT[], 7)
ON CONFLICT (name) DO NOTHING;
