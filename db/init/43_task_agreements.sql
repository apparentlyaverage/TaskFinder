-- 43_task_agreements.sql — Phase 2 C1+C2: price handshakes between the two parties
-- of an awarded task (creator ↔ assigned earner). Idempotent.
--
-- C1: a two-party price agreement. Either party PROPOSES an amount; the OTHER
--     accepts/declines. Every proposal + response is a row here = an immutable
--     audit trail. A new proposal supersedes any still-pending one.
-- C2: on acceptance, tasks.agreed_amount becomes the on-platform source-of-truth
--     price (seeded from the winning bid at award time). Escrow will read this.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS task_agreements (
    agreement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    proposed_by  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    note         VARCHAR(280),
    status       VARCHAR(12) NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed','accepted','declined','superseded')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_agreements_task ON task_agreements (task_id, created_at DESC);
-- At most one pending proposal per task (a new one supersedes the old).
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_agreement_pending ON task_agreements (task_id) WHERE status = 'proposed';
