// Batch 4 — the Available-Now rail: SAST "open now" math, presence heartbeat,
// the availability list/settings endpoints, and their validation.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default
const { isOpenNow, sastNow } = await import('../routes/availability.js')

const token = authToken({ userId: 'me-1', role: 'member' })

beforeEach(() => { vi.clearAllMocks() })

describe('sastNow (UTC → SA local, +2 no DST)', () => {
  it('maps a UTC instant to the SAST wall clock', () => {
    // 2026-07-13 is a Monday; 07:30Z → 09:30 SAST
    const { isoDay, hhmm } = sastNow(new Date('2026-07-13T07:30:00Z'))
    expect(isoDay).toBe(1)
    expect(hhmm).toBe('09:30')
  })
  it('rolls the ISO weekday forward when +2 crosses midnight', () => {
    // 22:30Z Mon → 00:30 SAST Tue (isoDay 2)
    const { isoDay, hhmm } = sastNow(new Date('2026-07-13T22:30:00Z'))
    expect(isoDay).toBe(2)
    expect(hhmm).toBe('00:30')
  })
})

describe('isOpenNow', () => {
  const mon0930 = new Date('2026-07-13T07:30:00Z') // 09:30 SAST, Monday
  it('open when the weekday matches and the time is inside the window', () => {
    expect(isOpenNow({ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }, mon0930)).toBe(true)
  })
  it('closed when the weekday is excluded', () => {
    expect(isOpenNow({ days: [6, 7], start: '09:00', end: '17:00' }, mon0930)).toBe(false)
  })
  it('respects the window bounds (start inclusive, end exclusive)', () => {
    expect(isOpenNow({ days: [1], start: '10:00', end: '17:00' }, mon0930)).toBe(false) // before start
    expect(isOpenNow({ days: [1], start: '08:00', end: '09:30' }, mon0930)).toBe(false) // end exclusive
    expect(isOpenNow({ days: [1], start: '08:00', end: '09:31' }, mon0930)).toBe(true)
  })
  it('false for null / malformed / overnight windows', () => {
    expect(isOpenNow(null, mon0930)).toBe(false)
    expect(isOpenNow({ days: [1], start: 'bad', end: '17:00' }, mon0930)).toBe(false)
    expect(isOpenNow({ days: [1], start: '22:00', end: '02:00' }, mon0930)).toBe(false) // start !< end
  })
})

describe('GET /availability/now', () => {
  it('401s without a token', async () => {
    const res = await request(app).get('/availability/now')
    expect(res.status).toBe(401)
  })
  it('returns online providers and drops anyone neither online nor open', async () => {
    let sql = ''
    mockDb(pool, (q) => {
      if (/FROM user_profiles up[\s\S]*JOIN users/.test(q)) {
        sql = q
        return { rows: [
          { user_id: 'p1', display_name: 'Naledi', avatar_url: null, avg_rating: '4.8', campus_zone: 'West Campus', headline: 'Maths tutor', working_hours: null, online: true },
          { user_id: 'p2', display_name: 'Thabo', avatar_url: null, avg_rating: '4.0', campus_zone: null, headline: null, working_hours: null, online: false },
        ] }
      }
    })
    const res = await request(app).get('/availability/now').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.providers).toHaveLength(1)
    expect(res.body.providers[0]).toMatchObject({ userId: 'p1', displayName: 'Naledi', online: true, openNow: false, headline: 'Maths tutor' })
    // never leak an exact last-seen timestamp to other members
    expect(JSON.stringify(res.body)).not.toMatch(/last_seen|lastSeen/)
    // query guards: opt-in only, providers only, exclude caller + deleted
    expect(sql).toMatch(/available_for_work = TRUE/)
    expect(sql).toMatch(/intent IN \('earn','both'\)/)
    expect(sql).toMatch(/u\.user_id <> \$1/)
    expect(sql).toMatch(/deleted_at IS NULL/)
  })
  it('includes an offline provider who is within working hours right now', async () => {
    const { isoDay } = sastNow(new Date())
    mockDb(pool, (q) => /FROM user_profiles up/.test(q) ? { rows: [
      { user_id: 'p3', display_name: 'Zola', avatar_url: null, avg_rating: '5.0', campus_zone: null, headline: null,
        working_hours: { days: [isoDay], start: '00:00', end: '23:59' }, online: false },
    ] } : undefined)
    const res = await request(app).get('/availability/now').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.providers).toHaveLength(1)
    expect(res.body.providers[0]).toMatchObject({ userId: 'p3', online: false, openNow: true })
  })
})

describe('PUT /availability', () => {
  it('saves the toggle + working hours (200)', async () => {
    let updated = false
    mockDb(pool, (q) => { if (/UPDATE user_profiles[\s\S]*available_for_work/.test(q)) { updated = true; return { rowCount: 1 } } })
    const res = await request(app).put('/availability').set('Authorization', `Bearer ${token}`)
      .send({ availableForWork: true, workingHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } })
    expect(res.status).toBe(200)
    expect(res.body.availableForWork).toBe(true)
    expect(updated).toBe(true)
  })
  it('allows clearing the schedule with null (200)', async () => {
    mockDb(pool, (q) => /UPDATE user_profiles/.test(q) ? { rowCount: 1 } : undefined)
    const res = await request(app).put('/availability').set('Authorization', `Bearer ${token}`)
      .send({ availableForWork: false, workingHours: null })
    expect(res.status).toBe(200)
    expect(res.body.workingHours).toBeNull()
  })
  it.each([
    ['weekday out of range', { days: [0, 1], start: '09:00', end: '17:00' }],
    ['empty days', { days: [], start: '09:00', end: '17:00' }],
    ['malformed time', { days: [1], start: '9am', end: '17:00' }],
    ['start not before end', { days: [1], start: '17:00', end: '09:00' }],
    ['duplicate days', { days: [1, 1], start: '09:00', end: '17:00' }],
  ])('422s invalid workingHours: %s', async (_label, wh) => {
    mockDb(pool)
    const res = await request(app).put('/availability').set('Authorization', `Bearer ${token}`)
      .send({ availableForWork: true, workingHours: wh })
    expect(res.status).toBe(422)
  })
  it('422s a non-boolean availableForWork', async () => {
    mockDb(pool)
    const res = await request(app).put('/availability').set('Authorization', `Bearer ${token}`)
      .send({ availableForWork: 'maybe', workingHours: null })
    expect(res.status).toBe(422)
  })
})

describe('GET /availability/me', () => {
  it('returns the caller availability settings', async () => {
    mockDb(pool, (q) => /SELECT available_for_work, working_hours FROM user_profiles/.test(q)
      ? { rows: [{ available_for_work: true, working_hours: { days: [1], start: '09:00', end: '17:00' } }] } : undefined)
    const res = await request(app).get('/availability/me').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ availableForWork: true, workingHours: { days: [1], start: '09:00', end: '17:00' } })
  })
})

describe('POST /availability/heartbeat', () => {
  it('204s for an authed user', async () => {
    mockDb(pool)
    const res = await request(app).post('/availability/heartbeat').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
  })
})

describe('presence heartbeat (requireAuth side-effect)', () => {
  it('bumps last_seen_at on an authed request', async () => {
    let beat = false
    mockDb(pool, (q) => { if (/UPDATE users SET last_seen_at = NOW\(\)/.test(q)) { beat = true; return { rowCount: 1 } } })
    // fresh userId so the in-process heartbeat throttle can't suppress the write
    const fresh = authToken({ userId: 'fresh-heartbeat-user', role: 'member' })
    await request(app).get('/availability/me').set('Authorization', `Bearer ${fresh}`)
    expect(beat).toBe(true)
  })
})
