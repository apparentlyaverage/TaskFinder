// Scheduling: publish availability slots, list open slots, book, cancel.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const ME    = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const BIZ   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SLOT  = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const BK    = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const token = authToken({ userId: ME, role: 'member' })
const startsAt = new Date(Date.now() + 2 * 3600e3).toISOString()
const endsAt   = new Date(Date.now() + 3 * 3600e3).toISOString()

beforeEach(() => vi.clearAllMocks())

describe('POST /scheduling/slots', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/scheduling/slots').send({ hostType: 'user', startsAt, endsAt })
    expect(res.status).toBe(401)
  })
  it('publishes a personal slot (201)', async () => {
    mockDb(pool, s => /INSERT INTO availability_slots/.test(s) ? { rows: [{ slot_id: SLOT, host_type: 'user', host_id: ME }] } : undefined)
    const res = await request(app).post('/scheduling/slots').set('Authorization', `Bearer ${token}`).send({ hostType: 'user', startsAt, endsAt })
    expect(res.status).toBe(201)
    expect(res.body.slot.slot_id).toBe(SLOT)
  })
  it('rejects a start time in the past (400)', async () => {
    mockDb(pool)
    const res = await request(app).post('/scheduling/slots').set('Authorization', `Bearer ${token}`)
      .send({ hostType: 'user', startsAt: new Date(Date.now() - 3600e3).toISOString(), endsAt })
    expect(res.status).toBe(400)
  })
  it('403s a business slot when the caller owns no business', async () => {
    mockDb(pool, s => /FROM businesses WHERE owner_id/.test(s) ? { rows: [] } : undefined)
    const res = await request(app).post('/scheduling/slots').set('Authorization', `Bearer ${token}`).send({ hostType: 'business', startsAt, endsAt })
    expect(res.status).toBe(403)
  })
})

describe('GET /scheduling/slots/:hostType/:hostId', () => {
  it('returns a host\'s open future slots (200)', async () => {
    mockDb(pool, s => /AS remaining/.test(s) ? { rows: [{ slot_id: SLOT, remaining: 1 }, { slot_id: 'x', remaining: 0 }] } : undefined)
    const res = await request(app).get(`/scheduling/slots/user/${OTHER}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.slots).toHaveLength(1) // the full one is filtered out
  })
})

describe('POST /scheduling/bookings', () => {
  const openSlot = (over = {}) => ({ slot_id: SLOT, host_type: 'user', host_id: OTHER, starts_at: startsAt, capacity: 1, booked: 0, ...over })
  it('books an open slot (201)', async () => {
    mockDb(pool, s => {
      if (/AS booked/.test(s)) return { rows: [openSlot()] }
      if (/INSERT INTO bookings/.test(s)) return { rows: [{ booking_id: BK }] }
    })
    const res = await request(app).post('/scheduling/bookings').set('Authorization', `Bearer ${token}`).send({ slotId: SLOT })
    expect(res.status).toBe(201)
  })
  it('forbids booking your own slot (400)', async () => {
    mockDb(pool, s => /AS booked/.test(s) ? { rows: [openSlot({ host_id: ME })] } : undefined)
    const res = await request(app).post('/scheduling/bookings').set('Authorization', `Bearer ${token}`).send({ slotId: SLOT })
    expect(res.status).toBe(400)
  })
  it('409s when the slot is full', async () => {
    mockDb(pool, s => /AS booked/.test(s) ? { rows: [openSlot({ booked: 1, capacity: 1 })] } : undefined)
    const res = await request(app).post('/scheduling/bookings').set('Authorization', `Bearer ${token}`).send({ slotId: SLOT })
    expect(res.status).toBe(409)
  })
  it('404s for a missing slot', async () => {
    mockDb(pool, s => /AS booked/.test(s) ? { rows: [] } : undefined)
    const res = await request(app).post('/scheduling/bookings').set('Authorization', `Bearer ${token}`).send({ slotId: SLOT })
    expect(res.status).toBe(404)
  })
})

describe('POST /scheduling/bookings/:id/cancel', () => {
  it('lets the guest cancel their booking (200)', async () => {
    mockDb(pool, s => {
      if (/FROM bookings bk JOIN availability_slots/.test(s)) return { rows: [{ booking_id: BK, guest_id: ME, status: 'booked', host_type: 'user', host_id: OTHER, slot_id: SLOT }] }
      if (/UPDATE bookings SET status = 'cancelled'/.test(s)) return { rows: [] }
    })
    const res = await request(app).post(`/scheduling/bookings/${BK}/cancel`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
  it('403s when it is not your booking and not your slot', async () => {
    mockDb(pool, s => /FROM bookings bk JOIN availability_slots/.test(s)
      ? { rows: [{ booking_id: BK, guest_id: OTHER, status: 'booked', host_type: 'user', host_id: BIZ, slot_id: SLOT }] } : undefined)
    const res = await request(app).post(`/scheduling/bookings/${BK}/cancel`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
