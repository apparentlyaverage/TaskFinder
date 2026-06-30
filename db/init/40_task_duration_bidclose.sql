-- 40_task_duration_bidclose.sql — Phase 2 B3 + B4. Idempotent.
--
-- B3: expected_duration — a creator's rough estimate of how long the task takes
--     (a label like "1–3 hours"), shown to bidders. Free text, validated to a
--     known set on the client.
-- B4: bids_close_at — an optional bidding cut-off. Enforced at bid time (no new
--     bids after it); independent of `deadline` (when the work is due).

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS expected_duration VARCHAR(40),
    ADD COLUMN IF NOT EXISTS bids_close_at     TIMESTAMPTZ;
