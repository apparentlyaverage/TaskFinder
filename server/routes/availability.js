// server/routes/availability.js — Batch 4: the Available-Now rail.
//
// Two signals decide if a provider is "available now":
//   • online   — users.last_seen_at within the last 5 min (heartbeat in middleware.js)
//   • open now  — the current SAST time falls inside their weekly working_hours
// A provider only ever appears if available_for_work is TRUE (explicit opt-in), so
// presence is never broadcast without consent. Reads are coarse — we expose the
// online/open booleans, never the exact last_seen timestamp of another user.
import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db.js'
import log from '../log.js'
import { requireAuth } from '../middleware.js'

const router = Router()
router.use(requireAuth)

function check(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}

const ONLINE_WINDOW = "5 minutes"
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// SA is UTC+2 year-round (no DST). Compute the local ISO weekday (1=Mon..7=Sun)
// and HH:MM so "open now" matches the wall clock a Makhanda user actually sees.
const SAST_OFFSET_MIN = 120
export function sastNow(date = new Date()) {
  const shifted = new Date(date.getTime() + SAST_OFFSET_MIN * 60_000)
  const jsDay = shifted.getUTCDay()           // 0=Sun..6=Sat
  const isoDay = jsDay === 0 ? 7 : jsDay       // 1=Mon..7=Sun
  const hhmm = shifted.toISOString().slice(11, 16) // "HH:MM" in the shifted (SAST) frame
  return { isoDay, hhmm }
}

// True if `wh` ({days:[1..7], start:"HH:MM", end:"HH:MM"}) covers the given SAST moment.
export function isOpenNow(wh, date = new Date()) {
  if (!wh || !Array.isArray(wh.days) || !HHMM.test(wh.start || '') || !HHMM.test(wh.end || '')) return false
  if (!(wh.start < wh.end)) return false       // same-day windows only (no overnight)
  const { isoDay, hhmm } = sastNow(date)
  return wh.days.includes(isoDay) && hhmm >= wh.start && hhmm < wh.end
}

// Reject anything that isn't a clean {days:[1..7 unique], start<end "HH:MM"} object.
function validWorkingHours(value) {
  if (value === null || value === undefined) return true   // clearing the schedule is allowed
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('workingHours must be an object or null')
  const { days, start, end } = value
  if (!Array.isArray(days) || days.length === 0) throw new Error('workingHours.days must be a non-empty array')
  if (!days.every(d => Number.isInteger(d) && d >= 1 && d <= 7)) throw new Error('workingHours.days must be integers 1-7 (Mon-Sun)')
  if (new Set(days).size !== days.length) throw new Error('workingHours.days must be unique')
  if (!HHMM.test(start || '')) throw new Error('workingHours.start must be HH:MM')
  if (!HHMM.test(end || '')) throw new Error('workingHours.end must be HH:MM')
  if (!(start < end)) throw new Error('workingHours.start must be before end (same-day window)')
  return true
}

// ── GET /availability/now — providers available right now ──
// Auth-gated (presence is member-only). Excludes the caller and deleted accounts.
router.get('/now', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, up.display_name, up.avatar_url, up.avg_rating,
              up.campus_zone, up.headline, up.working_hours,
              (u.last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}') AS online
         FROM user_profiles up
         JOIN users u ON u.user_id = up.user_id
        WHERE up.available_for_work = TRUE
          AND up.intent IN ('earn','both')
          AND u.deleted_at IS NULL
          AND u.user_id <> $1
          AND ( u.last_seen_at > NOW() - INTERVAL '${ONLINE_WINDOW}'
                OR up.working_hours IS NOT NULL )
        ORDER BY online DESC, up.avg_rating DESC NULLS LAST
        LIMIT 60`,
      [req.userId],
    )
    const now = new Date()
    const providers = rows
      .map(r => {
        const online = r.online === true
        const openNow = isOpenNow(r.working_hours, now)
        return { online, openNow, r }
      })
      .filter(x => x.online || x.openNow)
      .slice(0, 24)
      .map(({ online, openNow, r }) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        avgRating: r.avg_rating,
        campusZone: r.campus_zone,
        headline: r.headline,
        online,
        openNow,
      }))
    res.json({ providers })
  } catch (err) {
    log.error('availability.now_failed', { reqId: req.id, msg: err.message })
    res.status(500).json({ message: 'Could not load availability.' })
  }
})

// ── GET /availability/me — the caller's own availability settings ──
router.get('/me', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT available_for_work, working_hours FROM user_profiles WHERE user_id = $1', [req.userId])
    const row = rows[0] || {}
    res.json({ availableForWork: row.available_for_work === true, workingHours: row.working_hours ?? null })
  } catch (err) {
    log.error('availability.me_failed', { reqId: req.id, msg: err.message })
    res.status(500).json({ message: 'Could not load your availability.' })
  }
})

// ── PUT /availability — set the caller's availability ──
router.put('/',
  [
    body('availableForWork').isBoolean(),
    body('workingHours').custom(validWorkingHours),
  ],
  check,
  async (req, res) => {
    try {
      const availableForWork = req.body.availableForWork === true || req.body.availableForWork === 'true'
      const workingHours = req.body.workingHours ?? null
      const { rowCount } = await pool.query(
        `UPDATE user_profiles
            SET available_for_work = $1, working_hours = $2, updated_at = NOW()
          WHERE user_id = $3`,
        [availableForWork, workingHours === null ? null : JSON.stringify(workingHours), req.userId])
      if (rowCount === 0) return res.status(404).json({ message: 'Profile not found.' })
      res.json({ availableForWork, workingHours })
    } catch (err) {
      log.error('availability.update_failed', { reqId: req.id, msg: err.message })
      res.status(500).json({ message: 'Could not save your availability.' })
    }
  })

// ── POST /availability/heartbeat — explicit presence ping ──
// requireAuth already bumped last_seen_at; this just gives the client a cheap,
// dedicated endpoint to keep a provider "online" while idling on a page.
router.post('/heartbeat', (req, res) => res.status(204).end())

export default router
