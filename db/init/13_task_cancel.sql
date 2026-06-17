-- 13_task_cancel.sql — allow a creator to cancel an open task (§7.5).
-- The live DB already permits 'cancelled'; this keeps fresh installs (which run
-- 02_tasks_schema.sql without it) in sync. Idempotent: drops and re-adds the
-- status check with the full set.

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'in_progress', 'disputed', 'completed', 'expired', 'cancelled'));
