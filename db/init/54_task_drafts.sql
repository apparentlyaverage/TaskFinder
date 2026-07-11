-- 54_task_drafts.sql — task draft system (epic batch 2). Idempotent.
--
-- A draft is a task saved incomplete: only the title is required; description,
-- budget and deadline may be NULL until publish. Drafts are PRIVATE to their
-- creator — the read routes exclude them from every public surface, and the
-- expiry/archive jobs never touch them (status guards + NULL deadline).
--
--   • status gains 'draft' (constraint dropped + re-added, same pattern as 13/15).
--   • description / budget / deadline become nullable AT THE COLUMN level, with
--     a table CHECK enforcing completeness for every NON-draft status — so the
--     relaxation cannot leak incomplete rows into the live marketplace even if
--     an application bug tried to.

ALTER TABLE tasks ALTER COLUMN description DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN budget      DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN deadline    DROP NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('draft', 'open', 'in_progress', 'submitted', 'disputed', 'completed', 'expired', 'cancelled'));

-- Completeness gate: drafts may be partial; everything else must be whole.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_draft_completeness;
ALTER TABLE tasks ADD CONSTRAINT tasks_draft_completeness
    CHECK (status = 'draft' OR (description IS NOT NULL AND budget IS NOT NULL AND deadline IS NOT NULL));

-- Fast "my drafts" lookups without widening the main status index.
CREATE INDEX IF NOT EXISTS idx_tasks_creator_drafts ON tasks(creator_id) WHERE status = 'draft';
