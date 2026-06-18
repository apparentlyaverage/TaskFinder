-- 15_task_submitted.sql — two-party completion handshake (§7.5).
-- Adds a 'submitted' status: the earner submits finished work, then the creator
-- confirms completion. Idempotent (drops + re-adds the status check).

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'in_progress', 'submitted', 'disputed', 'completed', 'expired', 'cancelled'));
