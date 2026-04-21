CREATE TABLE stripe_accounts (
    account_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    stripe_account_id   TEXT UNIQUE NOT NULL,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE escrow_transactions (
    escrow_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id                  UUID UNIQUE NOT NULL REFERENCES tasks(task_id) ON DELETE RESTRICT,
    creator_id               UUID NOT NULL REFERENCES users(user_id),
    earner_id                UUID NOT NULL REFERENCES users(user_id),
    amount_cents             INTEGER NOT NULL CHECK (amount_cents > 0),
    platform_fee_cents       INTEGER NOT NULL DEFAULT 0,
    currency                 CHAR(3) NOT NULL DEFAULT 'usd',
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_transfer_id       TEXT,
    status                   VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','funded','released','refunded','disputed')),
    funded_at                TIMESTAMPTZ,
    released_at              TIMESTAMPTZ,
    refunded_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_escrow_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX idx_escrow_task_id    ON escrow_transactions(task_id);
CREATE INDEX idx_escrow_creator_id ON escrow_transactions(creator_id);
CREATE INDEX idx_escrow_status     ON escrow_transactions(status);