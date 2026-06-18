-- 27_referrals.sql — referral tracking for organic user growth.
-- Playbook target: user CAC below R20 by Month 6. Campus ambassador and
-- peer-referral programmes are the primary lever. This table lets us attribute
-- new signups to a referrer, measure conversion, and trigger referral rewards
-- once payments are live.

-- Add referral_code to users (generated on first login, shareable)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_code   VARCHAR(12) UNIQUE,
    ADD COLUMN IF NOT EXISTS referred_by_id  UUID REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by   ON users(referred_by_id);

-- Referral events — one row per successful referral (referee completes signup)
CREATE TABLE IF NOT EXISTS referrals (
    referral_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    referee_id    UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    -- Reward tracking (paid once referee completes first task)
    reward_amount NUMERIC(10,2),
    reward_paid   BOOLEAN NOT NULL DEFAULT FALSE,
    reward_paid_at TIMESTAMPTZ,
    paystack_ref  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created  ON referrals(created_at DESC);

-- Campus ambassador programme
CREATE TABLE IF NOT EXISTS ambassadors (
    ambassador_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    campus         TEXT NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','paused','retired')),
    referrals_count INTEGER NOT NULL DEFAULT 0,
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,  -- 10% of referred user's first task
    activated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes          TEXT
);
