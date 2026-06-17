-- 18_activity_logs.sql — append-only audit trail (§7.8).
-- This table is written by best-effort INSERTs across the codebase (registration,
-- login, consent, logout, etc.) but was never actually created, so those writes
-- silently no-op'd. Creating it switches the audit trail on and powers the admin
-- activity feed. Idempotent.

CREATE TABLE IF NOT EXISTS activity_logs (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role  VARCHAR(20),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,   -- all current actors/entities are UUIDs; keeps the
                        -- "$1 used for actor_id + entity_id" inserts type-consistent

    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_actor   ON activity_logs(actor_id);
