-- 49_push_subscriptions.sql — Phase 2 H1: Web Push subscriptions. Idempotent.
-- One row per browser/device a user has granted notifications on. The endpoint is
-- unique (re-subscribing upserts); dead ones (404/410 from the push service) are
-- pruned by push.sendPush.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys     JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);
