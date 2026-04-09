CREATE TABLE task_matches (
    match_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    earner_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    score        NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_notified  BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_task_earner UNIQUE (task_id, earner_id)
);

CREATE TABLE job_audit_log (
    log_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name         VARCHAR(100) NOT NULL,
    status           VARCHAR(20) NOT NULL CHECK (status IN ('started','completed','failed')),
    records_affected INTEGER DEFAULT 0,
    error_message    TEXT,
    started_at       TIMESTAMPTZ DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_matches_earner_id   ON task_matches(earner_id);
CREATE INDEX idx_matches_task_id     ON task_matches(task_id);
CREATE INDEX idx_matches_unnotified  ON task_matches(is_notified) WHERE is_notified = FALSE;