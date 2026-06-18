-- 26_reliability_score.sql — ReLivR Reliability Score foundation.
--
-- The ReLivR Score (playbook Phase 0, M12) is a worker-facing trust signal
-- derived from on-platform behaviour: task completion rate, review quality,
-- response time, dispute history, and tenure. Phase 1 validates it against
-- external lender repayment data before it powers the credit API (M18–19).
--
-- Architecture:
--   score_events    — append-only behavioural signals (one row per event)
--   reliability_scores — latest computed score per user (recomputed async)
--
-- POPIA note: score_events contain no personal data beyond user_id. The
-- scoring algorithm is documented and auditable (bias_audit_at tracks when
-- the last audit was run). Users can see their own score in the app.

-- ── Raw behavioural signals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_events (
    event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    event_type  VARCHAR(60) NOT NULL,
    -- Positive signals
    -- 'task_completed'   — earner delivered and creator confirmed
    -- 'review_received'  — received a review (weight by star rating)
    -- 'quick_response'   — replied to message within 30 minutes
    -- 'bid_accepted'     — bid accepted (demand signal)
    -- 'repeat_creator'   — same creator hired this earner again
    -- Negative signals
    -- 'task_abandoned'   — earner accepted then did not deliver
    -- 'dispute_raised'   — dispute opened against this earner
    -- 'dispute_lost'     — platform ruled against earner
    -- 'late_delivery'    — completed after agreed deadline
    weight      NUMERIC(5,2) NOT NULL DEFAULT 1.0,  -- positive or negative
    reference_id UUID,          -- task_id, review_id, dispute_id, etc.
    metadata    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_se_user    ON score_events(user_id);
CREATE INDEX IF NOT EXISTS idx_se_type    ON score_events(event_type);
CREATE INDEX IF NOT EXISTS idx_se_created ON score_events(created_at DESC);

-- ── Computed scores (recomputed by background job) ───────────────────────────
CREATE TABLE IF NOT EXISTS reliability_scores (
    score_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    score            NUMERIC(5,2) NOT NULL DEFAULT 0.00
                         CHECK (score BETWEEN 0 AND 100),
    -- Component sub-scores (0–100 each) for transparency
    completion_rate  NUMERIC(5,2),
    review_quality   NUMERIC(5,2),
    response_speed   NUMERIC(5,2),
    dispute_rate     NUMERIC(5,2),
    -- Metadata
    events_counted   INTEGER NOT NULL DEFAULT 0,
    score_version    INTEGER NOT NULL DEFAULT 1,   -- bump when algorithm changes
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Credit-API gate: score is only shared with lenders after this passes
    bias_audit_at    TIMESTAMPTZ,  -- NULL = not yet audited
    lender_eligible  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_rs_score   ON reliability_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_rs_eligible ON reliability_scores(lender_eligible);

-- Expose score on user_profiles for the in-app display (Phase 0, M12)
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5,2);
