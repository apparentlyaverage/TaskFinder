// server/idnumber.js — SA ID number validation + at-rest encryption (batch 3).
//
// POPIA-sensitive. Rules:
//   • The raw ID number is NEVER logged, echoed, or returned in any response.
//   • At rest it is AES-256-GCM ciphertext; the key lives ONLY in the
//     ID_ENCRYPTION_KEY env var, so a DB dump alone reveals nothing.
//   • A deterministic keyed hash (HMAC-SHA256, key derived from the same secret)
//     backs a UNIQUE index for one-account-per-ID, without ever decrypting.
//
// Optional-provider pattern (like Cloudinary/VAPID/Turnstile): if the key is
// absent/malformed, idConfigured() is false and storage is skipped — validation
// still runs so the form behaves, we just don't persist. Prod sets the key.
import crypto from 'node:crypto'
import log from './log.js'

// Accept the key as base64 (44 chars) or hex (64 chars) → 32 raw bytes.
function loadKey() {
  const raw = process.env.ID_ENCRYPTION_KEY
  if (!raw) return null
  try {
    let buf
    if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) buf = Buffer.from(raw.trim(), 'hex')
    else buf = Buffer.from(raw.trim(), 'base64')
    if (buf.length !== 32) throw new Error(`key must be 32 bytes, got ${buf.length}`)
    return buf
  } catch (err) {
    log.error('idnumber.key_invalid', { msg: err.message })
    return null
  }
}
const KEY = loadKey()
export function idConfigured() { return KEY !== null }

// Strip to digits only.
function normalize(raw) { return String(raw ?? '').replace(/\D/g, '') }

// Luhn checksum over the whole 13-digit string (SA ID uses standard Luhn).
function luhnValid(digits) {
  let sum = 0, alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (alt) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    alt = !alt
  }
  return sum % 10 === 0
}

// Structural + checksum validation for a South African ID number.
// Returns { valid: true } or { valid: false, reason }.
export function validateSaId(raw) {
  const id = normalize(raw)
  if (id.length !== 13) return { valid: false, reason: 'ID number must be exactly 13 digits.' }
  // YYMMDD birth-date sanity (positions 0–5). We don't store the DOB, only sanity-check.
  const mm = +id.slice(2, 4), dd = +id.slice(4, 6)
  if (mm < 1 || mm > 12) return { valid: false, reason: 'ID number contains an invalid birth month.' }
  if (dd < 1 || dd > 31) return { valid: false, reason: 'ID number contains an invalid birth day.' }
  // Citizenship digit (position 10) is 0 (SA citizen) or 1 (permanent resident).
  if (id[10] !== '0' && id[10] !== '1') return { valid: false, reason: 'ID number has an invalid citizenship digit.' }
  if (!luhnValid(id)) return { valid: false, reason: 'ID number failed the checksum — please re-check it.' }
  return { valid: true }
}

// express-validator .custom() helper — throws (with the reason) on invalid.
export function saIdValidator(value) {
  const r = validateSaId(value)
  if (!r.valid) throw new Error(r.reason)
  return true
}

// AES-256-GCM. Output: base64(iv):base64(tag):base64(ciphertext).
export function encryptId(raw) {
  if (!KEY) throw new Error('ID encryption is not configured.')
  const id = normalize(raw)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const ct = Buffer.concat([cipher.update(id, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

// Deterministic keyed hash for the uniqueness index. Domain-separated from the
// encryption use of the same secret via a fixed prefix.
export function hashId(raw) {
  if (!KEY) throw new Error('ID encryption is not configured.')
  return crypto.createHmac('sha256', KEY).update('relivr:id:' + normalize(raw)).digest('hex')
}
