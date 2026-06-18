// server/locationValidate.js — single source of truth for validating a chosen
// campus/zone name against the data-driven `locations` table (replaces the old
// Rhodes-only arrays that were copy-pasted into auth.js and profile.js).
//
// Design: location is OPTIONAL and NON-GATING.
//  • empty/undefined → valid (field is optional).
//  • otherwise must match an active location name (campus or zone).
//  • FAIL-OPEN: if the lookup errors, accept the value. A non-critical display
//    field must never block registration/profile edits on a DB hiccup.
import { pool } from './db.js'
import log from './log.js'

export async function isValidLocationName(value) {
  if (value === undefined || value === null || String(value).trim() === '') return true
  try {
    const { rows } = await pool.query(
      'SELECT 1 FROM locations WHERE lower(name) = lower($1) AND is_active = TRUE LIMIT 1',
      [String(value).trim()])
    return rows.length > 0
  } catch (err) {
    log.error('location.validate_failed', { msg: err.message })
    return true // fail-open — availability over strictness for an optional field
  }
}

// Resolve a location name to its id for the optional user_profiles.location_id
// FK (TD-12 normalization). Returns null when absent/unknown or on error — the
// denormalised campus_zone text remains the source of truth, so this is best-effort.
export async function resolveLocationId(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  try {
    const { rows } = await pool.query(
      'SELECT location_id FROM locations WHERE lower(name) = lower($1) AND is_active = TRUE LIMIT 1',
      [String(value).trim()])
    return rows[0]?.location_id ?? null
  } catch (err) {
    log.error('location.resolve_failed', { msg: err.message })
    return null
  }
}

// express-validator `.custom()` helper. NOTE: async custom validators only fail
// when they THROW (a resolved `false` is treated as valid), so we throw here.
export async function validateLocationName(value) {
  const ok = await isValidLocationName(value)
  if (!ok) throw new Error('Please choose a location from the list.')
  return true
}
