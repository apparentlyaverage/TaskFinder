-- 19_activity_entity_uuid.sql — make activity_logs.entity_id a UUID (§7.8).
-- Migration 18 first shipped it as TEXT; with entity_id as TEXT the audit
-- INSERTs (which reuse $1 for both actor_id (UUID) and entity_id) failed with
-- "inconsistent types deduced for parameter $1" and silently no-op'd. UUID makes
-- the reused parameter type-consistent. Idempotent (no-op if already UUID).

ALTER TABLE activity_logs ALTER COLUMN entity_id TYPE UUID USING entity_id::uuid;
