-- 17_index_audit.sql — fill index gaps on hot query paths (§7.7). Idempotent.

-- tasks.assigned_to: used by GET /tasks/mine, public profiles (completed work),
-- and dispute participant checks — was unindexed.
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- The main feed query filters by status and orders by created_at DESC.
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at DESC);

-- reviews.reviewer_id: used by the data export and "reviews I left".
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);

-- Trigram indexes so universal search (ILIKE '%term%') is indexable rather than
-- a full scan. pg_trgm is available on Neon/standard Postgres.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON user_profiles USING GIN (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm   ON tasks USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING GIN (name gin_trgm_ops);
