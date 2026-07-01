-- 46_retainers.sql — Phase 2 F1b: recurring engagements ("retainers"). Idempotent.
--
-- A client sets up a standing recurring arrangement with a provider (e.g. weekly
-- tutoring). On schedule, jobs.runRetainers spawns a task pre-assigned to the
-- provider (status in_progress, agreed_amount = the rate — the C2 source of truth)
-- and notifies them. Payment automation hooks in with escrow (G1); until then the
-- pair settle as they do for any task today.

CREATE TABLE IF NOT EXISTS retainers (
    retainer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    cadence     VARCHAR(10) NOT NULL CHECK (cadence IN ('weekly','monthly')),
    next_run_at TIMESTAMPTZ NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retainers_client   ON retainers (client_id);
CREATE INDEX IF NOT EXISTS idx_retainers_provider ON retainers (provider_id);
CREATE INDEX IF NOT EXISTS idx_retainers_due      ON retainers (next_run_at) WHERE active;
