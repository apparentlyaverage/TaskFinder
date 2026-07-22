-- 59_task_fcfs.sql — first-come-first-serve tasks. Idempotent.
--
-- Tasks default to the bidding model (creator posts, earners bid, creator picks
-- a winner). FCFS is an alternative claim model: the creator sets a fixed price
-- (the existing `budget`), and the FIRST earner to claim the task is assigned it
-- immediately — no bids, no waiting. `assignment_mode` selects which model a task
-- uses; existing rows keep the bidding contract via the DEFAULT.
--
-- The claim itself is a single atomic UPDATE guarded on status/assigned_to (see
-- POST /tasks/:taskId/claim in routes/tasks.js), so two simultaneous claims can
-- never both win — the loser gets a 409.

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS assignment_mode VARCHAR(10) NOT NULL DEFAULT 'bid'
        CHECK (assignment_mode IN ('bid', 'fcfs'));
