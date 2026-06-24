-- 36_recurring_deals.sql — recurring "Limited Time Specials" (§7.11.2).
--
-- A deal can repeat: when it expires, jobs.refreshRecurringDeals() re-activates
-- it in place for another window (refresh-in-place keeps one stable "Tuesday
-- special" row; cycle history lives in page-events / redemptions). The active
-- window per cycle is active_window_s (captured from the first window at create);
-- if null it falls back to the recurrence interval. recurrence_until optionally
-- ends the series. Idempotent.

ALTER TABLE campus_deals
    ADD COLUMN IF NOT EXISTS recurrence       VARCHAR(10) NOT NULL DEFAULT 'none'
                                                CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
    ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS active_window_s  INTEGER CHECK (active_window_s IS NULL OR active_window_s > 0);

-- The refresh sweep looks for expired, still-recurring deals.
CREATE INDEX IF NOT EXISTS idx_deals_recurring ON campus_deals (recurrence) WHERE recurrence <> 'none';
