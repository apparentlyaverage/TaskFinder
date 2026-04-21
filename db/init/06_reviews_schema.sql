CREATE TABLE reviews (
    review_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(task_id) ON DELETE RESTRICT,
    reviewer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('creator','earner')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_review UNIQUE (task_id, reviewer_id)
);

CREATE TABLE disputes (
    dispute_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id        UUID UNIQUE NOT NULL REFERENCES tasks(task_id) ON DELETE RESTRICT,
    raised_by      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason         TEXT NOT NULL,
    evidence_urls  TEXT[],
    status         VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved_creator','resolved_earner','closed')),
    assigned_admin UUID REFERENCES users(user_id) ON DELETE SET NULL,
    admin_notes    TEXT,
    resolution     VARCHAR(20) CHECK (resolution IN ('refund','release','split')),
    opened_at      TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dispute_events (
    event_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES disputes(dispute_id) ON DELETE CASCADE,
    actor_id   UUID NOT NULL REFERENCES users(user_id),
    action     VARCHAR(50) NOT NULL,
    note       TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_disputes_task_id    ON disputes(task_id);
CREATE INDEX idx_disputes_status     ON disputes(status);
CREATE INDEX idx_dispute_events      ON dispute_events(dispute_id);