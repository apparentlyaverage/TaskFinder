-- 45_deal_expiry_notify.sql — Phase 2 F2: guard for the "deal ending soon" sweep.
-- Set once when a deal's followers have been warned it's about to expire, so the
-- jobs.notifyExpiringDeals scan never double-notifies. Idempotent.

ALTER TABLE campus_deals ADD COLUMN IF NOT EXISTS expiring_notified_at TIMESTAMPTZ;
