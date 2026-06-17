-- 16_task_templates.sql — reusable + recurring task templates (§7.5).
-- A template is a saved task definition a creator can spawn on demand
-- (POST /templates/:id/use) or on a schedule (recurrence + next_run_at, driven
-- by the sendRecurring job). deadline_days sets each spawned task's deadline
-- relative to when it's created. Idempotent.

CREATE TABLE IF NOT EXISTS task_templates (
    template_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    description   TEXT NOT NULL,
    budget        NUMERIC(10,2) NOT NULL CHECK (budget > 0),
    deadline_days INTEGER NOT NULL DEFAULT 7 CHECK (deadline_days > 0),
    skill_tags    TEXT[],
    campus_zone   TEXT,
    recurrence    VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
    next_run_at   TIMESTAMPTZ,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_due  ON task_templates(next_run_at)
    WHERE is_active AND recurrence <> 'none';
