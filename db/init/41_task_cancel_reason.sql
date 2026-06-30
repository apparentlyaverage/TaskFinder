-- 41_task_cancel_reason.sql — Phase 2 B6. Idempotent.
-- Captures the creator's optional reason when cancelling an OPEN task, so it can
-- be shown to the declined bidders and kept on record. (Post-award cancellation —
-- with escrow/dispute implications — is deferred until payments land.)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(200);
