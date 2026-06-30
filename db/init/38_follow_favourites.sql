-- 38_follow_favourites.sql — "favourite/save" flag on a follow edge (Phase 1, F1a).
--
-- A favourite is a follow the user has starred for quick re-hiring; favouriting
-- implies following (the toggle upserts the edge). Lives on the existing follows
-- table rather than a new one, so the "following" feed and counts are unchanged.
-- Idempotent per repo convention.

ALTER TABLE follows ADD COLUMN IF NOT EXISTS favourite BOOLEAN NOT NULL DEFAULT FALSE;

-- Hot lookup: a user's favourites (partial index — only the starred rows).
CREATE INDEX IF NOT EXISTS idx_follows_favourite ON follows (follower_id) WHERE favourite;
