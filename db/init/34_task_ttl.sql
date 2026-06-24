-- 34_task_ttl.sql — global task time-to-live + archival (§7.11.2).
--
-- Tasks already auto-expire when an OPEN task passes its `deadline`
-- (jobs.expireDueTasks). This adds:
--   • expires_at  — an optional HARD TTL, independent of deadline. Once passed,
--                   the archive sweep removes the task from default feeds.
--   • archived_at — set by jobs.archiveExpiredTasks (past-TTL, or terminal tasks
--                   older than a retention window). Default browse/feed queries
--                   add `AND archived_at IS NULL`, so archival is the authoritative
--                   visibility control (the sweep just stamps the timestamp).
-- POPIA data-minimisation: old terminal tasks fall out of active circulation.
-- Idempotent.

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Supports the sweep (find live, past-TTL rows) and keeps the active-feed lookups
-- scanning only un-archived tasks.
CREATE INDEX IF NOT EXISTS idx_tasks_ttl ON tasks (expires_at) WHERE archived_at IS NULL;
