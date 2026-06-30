// server/routes/scheduling.js — availability calendars + bookings (§D1/D2/D3).
//
// A HOST (a user offering services, or a business) publishes bookable time slots;
// a GUEST books one. Polymorphic host (host_type + host_id) so one system serves
// taskers (D1) and businesses (D2). Capacity-aware (a slot can take N bookings).
// Reminders (D3) are sent by jobs.sendBookingReminders.
import { Router } from 'express'
import { body, param, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'
import { createNotification } from '../notify.js'

const router = Router()
router.use(requireAuth)

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

// The caller's business (one per owner), or null.
async function myBusinessId(userId) {
  const { rows } = await pool.query('SELECT business_id FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [userId])
  return rows[0]?.business_id || null
}
// Who "owns" a host (a user → themselves; a business → its owner) — used to notify
// and to stop someone booking their own slot.
async function hostOwner(hostType, hostId) {
  if (hostType === 'user') return hostId
  const { rows } = await pool.query('SELECT owner_id FROM businesses WHERE business_id = $1', [hostId])
  return rows[0]?.owner_id || null
}

// ── Publish a bookable slot ──
// POST /scheduling/slots  { hostType, startsAt, endsAt, capacity?, note? }
router.post('/slots',
  [
    body('hostType').isIn(['user', 'business']),
    body('startsAt').isISO8601(),
    body('endsAt').isISO8601(),
    body('capacity').optional().isInt({ min: 1, max: 100 }),
    body('note').optional({ nullable: true }).trim().isLength({ max: 200 }),
  ],
  check,
  async (req, res) => {
    const { hostType, startsAt, endsAt } = req.body
    const capacity = req.body.capacity || 1
    const note = (req.body.note || '').toString().trim().slice(0, 200) || null
    if (new Date(startsAt).getTime() <= Date.now()) return res.status(400).json({ message: 'The start time must be in the future.' })
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return res.status(400).json({ message: 'The end time must be after the start time.' })
    try {
      let hostId = req.userId
      if (hostType === 'business') {
        hostId = await myBusinessId(req.userId)
        if (!hostId) return res.status(403).json({ message: 'No business is linked to your account.' })
      }
      const { rows } = await pool.query(
        `INSERT INTO availability_slots (host_type, host_id, starts_at, ends_at, capacity, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [hostType, hostId, startsAt, endsAt, capacity, note, req.userId])
      return res.status(201).json({ slot: rows[0] })
    } catch (err) {
      log.error('POST /scheduling/slots', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── My availability (slots I host as a user + as my business), with bookings ──
// GET /scheduling/slots/mine   (declared before /:hostType/:hostId)
router.get('/slots/mine', async (req, res) => {
  try {
    const bizId = await myBusinessId(req.userId)
    const { rows } = await pool.query(
      `SELECT s.*,
              COALESCE(json_agg(json_build_object('booking_id', bk.booking_id, 'guest_id', bk.guest_id, 'guest_name', up.display_name)
                       ORDER BY bk.created_at) FILTER (WHERE bk.booking_id IS NOT NULL), '[]') AS bookings
         FROM availability_slots s
         LEFT JOIN bookings bk ON bk.slot_id = s.slot_id AND bk.status = 'booked'
         LEFT JOIN user_profiles up ON up.user_id = bk.guest_id
        WHERE (s.host_type = 'user' AND s.host_id = $1) OR (s.host_type = 'business' AND s.host_id = $2::uuid)
        GROUP BY s.slot_id
        ORDER BY s.starts_at ASC`, [req.userId, bizId])
    return res.status(200).json({ slots: rows })
  } catch (err) {
    log.error('GET /scheduling/slots/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── A host's open, future slots (for a guest to book) ──
// GET /scheduling/slots/:hostType/:hostId
router.get('/slots/:hostType/:hostId',
  [param('hostType').isIn(['user', 'business']), param('hostId').isUUID()],
  check,
  async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT s.*, (s.capacity - COALESCE(b.cnt, 0))::int AS remaining
           FROM availability_slots s
           LEFT JOIN (SELECT slot_id, COUNT(*) cnt FROM bookings WHERE status = 'booked' GROUP BY slot_id) b ON b.slot_id = s.slot_id
          WHERE s.host_type = $1 AND s.host_id = $2 AND s.starts_at > NOW()
          ORDER BY s.starts_at ASC`, [req.params.hostType, req.params.hostId])
      return res.status(200).json({ slots: rows.filter(r => r.remaining > 0) })
    } catch (err) {
      log.error('GET /scheduling/slots/:host', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── Remove a slot (host only) — cancels any bookings and notifies those guests ──
// DELETE /scheduling/slots/:slotId
router.delete('/slots/:slotId', [param('slotId').isUUID()], check, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM availability_slots WHERE slot_id = $1', [req.params.slotId])
    const slot = rows[0]
    if (!slot) return res.status(404).json({ message: 'Slot not found.' })
    const owner = await hostOwner(slot.host_type, slot.host_id)
    if (owner !== req.userId && slot.created_by !== req.userId) return res.status(403).json({ message: 'Not your slot.' })
    const guests = await pool.query("SELECT guest_id FROM bookings WHERE slot_id = $1 AND status = 'booked'", [req.params.slotId])
    await pool.query('DELETE FROM availability_slots WHERE slot_id = $1', [req.params.slotId]) // bookings cascade
    for (const g of guests.rows) {
      createNotification({ userId: g.guest_id, type: 'booking.cancelled', title: 'A booking was cancelled', body: 'A time slot you booked on ReLivR was removed by the host.', referenceId: req.params.slotId }).catch(() => {})
    }
    return res.status(200).json({ message: 'Slot removed.' })
  } catch (err) {
    log.error('DELETE /scheduling/slots/:slotId', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── Book a slot ──
// POST /scheduling/bookings  { slotId, note? }
router.post('/bookings',
  [body('slotId').isUUID(), body('note').optional({ nullable: true }).trim().isLength({ max: 200 })],
  check,
  async (req, res) => {
    const { slotId } = req.body
    const note = (req.body.note || '').toString().trim().slice(0, 200) || null
    try {
      const { rows } = await pool.query(
        `SELECT s.*, (SELECT COUNT(*) FROM bookings WHERE slot_id = s.slot_id AND status = 'booked')::int AS booked
           FROM availability_slots s WHERE s.slot_id = $1`, [slotId])
      const slot = rows[0]
      if (!slot) return res.status(404).json({ message: 'That time slot no longer exists.' })
      if (new Date(slot.starts_at).getTime() <= Date.now()) return res.status(409).json({ message: 'That time has already started.' })
      if (slot.booked >= slot.capacity) return res.status(409).json({ message: 'That slot is fully booked.' })
      const owner = await hostOwner(slot.host_type, slot.host_id)
      if (owner === req.userId) return res.status(400).json({ message: "You can't book your own slot." })
      let booking
      try {
        const ins = await pool.query('INSERT INTO bookings (slot_id, guest_id, note) VALUES ($1,$2,$3) RETURNING *', [slotId, req.userId, note])
        booking = ins.rows[0]
      } catch (err) {
        if (/uq_booking_active|duplicate key|unique/i.test(err.message)) return res.status(409).json({ message: 'You have already booked this slot.' })
        throw err
      }
      if (owner) createNotification({ userId: owner, type: 'booking.new', title: 'New booking', body: 'Someone booked one of your time slots on ReLivR.', referenceId: slotId }).catch(() => {})
      return res.status(201).json({ booking })
    } catch (err) {
      log.error('POST /scheduling/bookings', { reqId: req.id, msg: err.message })
      return res.status(500).json({ message: 'Internal server error.' })
    }
  }
)

// ── My upcoming bookings (as a guest) ──
// GET /scheduling/bookings/mine
router.get('/bookings/mine', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bk.booking_id, bk.status, bk.note, s.slot_id, s.starts_at, s.ends_at, s.host_type, s.host_id,
              CASE WHEN s.host_type = 'business' THEN bz.name ELSE up.display_name END AS host_name
         FROM bookings bk
         JOIN availability_slots s ON s.slot_id = bk.slot_id
         LEFT JOIN businesses bz ON s.host_type = 'business' AND bz.business_id = s.host_id
         LEFT JOIN user_profiles up ON s.host_type = 'user' AND up.user_id = s.host_id
        WHERE bk.guest_id = $1 AND bk.status = 'booked' AND s.starts_at > NOW() - INTERVAL '1 day'
        ORDER BY s.starts_at ASC`, [req.userId])
    return res.status(200).json({ bookings: rows })
  } catch (err) {
    log.error('GET /scheduling/bookings/mine', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

// ── Cancel a booking (the guest, or the host) ──
// POST /scheduling/bookings/:id/cancel
router.post('/bookings/:id/cancel', [param('id').isUUID()], check, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bk.*, s.host_type, s.host_id FROM bookings bk JOIN availability_slots s ON s.slot_id = bk.slot_id WHERE bk.booking_id = $1`, [req.params.id])
    const bk = rows[0]
    if (!bk) return res.status(404).json({ message: 'Booking not found.' })
    const owner = await hostOwner(bk.host_type, bk.host_id)
    const isGuest = bk.guest_id === req.userId
    const isHost = owner === req.userId
    if (!isGuest && !isHost) return res.status(403).json({ message: 'Not your booking.' })
    if (bk.status !== 'booked') return res.status(409).json({ message: 'This booking is already cancelled.' })
    await pool.query("UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE booking_id = $1", [req.params.id])
    const notifyUser = isGuest ? owner : bk.guest_id
    if (notifyUser) createNotification({ userId: notifyUser, type: 'booking.cancelled', title: 'Booking cancelled', body: 'A booking was cancelled on ReLivR.', referenceId: bk.slot_id }).catch(() => {})
    return res.status(200).json({ message: 'Booking cancelled.' })
  } catch (err) {
    log.error('POST /scheduling/bookings/:id/cancel', { reqId: req.id, msg: err.message })
    return res.status(500).json({ message: 'Internal server error.' })
  }
})

export default router
