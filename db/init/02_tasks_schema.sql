CREATE TABLE tasks (
    task_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT NOT NULL,
    budget       NUMERIC(10,2) NOT NULL CHECK (budget > 0),
    deadline     TIMESTAMPTZ NOT NULL,
    skill_tags   TEXT[],
    status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','disputed','completed','expired')),
    assigned_to  UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bids (
    bid_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    bidder_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    pitch      TEXT NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_active_bid UNIQUE (task_id, bidder_id)
);

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_bids_updated_at  BEFORE UPDATE ON bids  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX idx_tasks_status     ON tasks(status);
CREATE INDEX idx_tasks_skill_tags ON tasks USING GIN(skill_tags);
CREATE INDEX idx_bids_task_id     ON bids(task_id);
CREATE INDEX idx_bids_bidder_id   ON bids(bidder_id);