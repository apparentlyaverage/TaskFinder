-- 35_follows.sql — social/relationship graph (§7.11.1).
--
-- A many-to-many "follow" edge: a user follows another USER or a BUSINESS.
-- Polymorphic target (target_type + target_id) so one table + one "following"
-- feed query covers both. target_id is users.user_id OR businesses.business_id
-- (both UUID); it can't be a hard FK, so existence is enforced in the app and
-- orphans are cleaned on entity delete / by a sweep (see routes/follows.js).
--
-- Composite PK gives idempotent follows (ON CONFLICT DO NOTHING) and blocks dups.
-- Idempotent migration per repo convention.

CREATE TABLE IF NOT EXISTS follows (
    follower_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_type  VARCHAR(10) NOT NULL CHECK (target_type IN ('user', 'business')),
    target_id    UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, target_type, target_id)
);

-- "Who follows X" + follower counts (the hot lookup for the Follow button).
CREATE INDEX IF NOT EXISTS idx_follows_target   ON follows (target_type, target_id);
-- "X's following feed".
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows (follower_id);
