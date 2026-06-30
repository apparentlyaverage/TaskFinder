-- 44_scheduling.sql — Phase 2 D1/D2/D3: availability calendars + bookings. Idempotent.
--
-- A HOST publishes bookable time slots; a GUEST books one. The host is polymorphic
-- (host_type + host_id) so one system serves both an individual offering services
-- (D1, host_type='user') and a business taking appointments (D2, host_type='business').
-- Reminders (D3) fire from jobs.sendBookingReminders before a slot starts.

CREATE TABLE IF NOT EXISTS availability_slots (
    slot_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_type  VARCHAR(10) NOT NULL CHECK (host_type IN ('user','business')),
    host_id    UUID NOT NULL,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    capacity   SMALLINT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
    note       VARCHAR(200),
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slot_window CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_slots_host ON availability_slots (host_type, host_id, starts_at);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id      UUID NOT NULL REFERENCES availability_slots(slot_id) ON DELETE CASCADE,
    guest_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status       VARCHAR(10) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled')),
    note         VARCHAR(200),
    reminded_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bookings_slot  ON bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings (guest_id, created_at DESC);
-- One active booking per guest per slot (re-booking after cancelling is allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_active ON bookings (slot_id, guest_id) WHERE status = 'booked';
