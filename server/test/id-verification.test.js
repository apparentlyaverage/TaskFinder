// SA ID verification (batch 3): strict 13-digit + Luhn validation, at-rest
// encryption, keyed-hash uniqueness. The key is set BEFORE importing the app so
// idnumber.js loads configured — this also exercises the storage wiring.
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import request from 'supertest'

process.env.ID_ENCRYPTION_KEY = 'xyzu+DDvavT829/uq9/drnZWxRokaXtM6TWm0WIX+jI=' // throwaway 32-byte test key

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const idmod = await import('../idnumber.js')
const app = (await import('../app.js')).default

const VALID = '8001015009087'   // 13-digit, Luhn-valid, valid month/day/citizenship
const VALID2 = '9001010001088'

afterAll(() => { delete process.env.ID_ENCRYPTION_KEY })
beforeEach(() => { vi.clearAllMocks(); pool.query.mockResolvedValue({ rows: [] }) })

describe('idnumber.js — validation', () => {
  it('accepts a well-formed SA ID', () => {
    expect(idmod.validateSaId(VALID)).toEqual({ valid: true })
    expect(idmod.validateSaId('800101 5009 087')).toEqual({ valid: true }) // spaces stripped
  })
  it('rejects wrong length', () => {
    expect(idmod.validateSaId('8001015009').valid).toBe(false)
    expect(idmod.validateSaId('80010150090870').valid).toBe(false)
  })
  it('rejects a bad checksum (Luhn)', () => {
    expect(idmod.validateSaId('8001015009088').valid).toBe(false)
  })
  it('rejects an impossible birth month/day', () => {
    expect(idmod.validateSaId('8013015009087').valid).toBe(false) // month 13
  })
  it('rejects a bad citizenship digit', () => {
    // position 10 must be 0 or 1 — flip it and it should fail (structure or luhn)
    expect(idmod.validateSaId('8001015009287').valid).toBe(false)
  })
})

describe('idnumber.js — encryption + hashing', () => {
  it('encrypts to iv:tag:ct and is not the raw number', () => {
    const enc = idmod.encryptId(VALID)
    expect(enc.split(':')).toHaveLength(3)
    expect(enc).not.toContain(VALID)
  })
  it('produces a different ciphertext each call (random IV)', () => {
    expect(idmod.encryptId(VALID)).not.toBe(idmod.encryptId(VALID))
  })
  it('hashes deterministically, distinct per ID, never the raw number', () => {
    expect(idmod.hashId(VALID)).toBe(idmod.hashId('8001015009087'))
    expect(idmod.hashId(VALID)).not.toBe(idmod.hashId(VALID2))
    expect(idmod.hashId(VALID)).not.toContain(VALID)
  })
})

describe('POST /auth/register — ID field', () => {
  function registerClient(capture, { insertThrows } = {}) {
    return {
      query: vi.fn(async (sql, params) => {
        if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return {}
        if (/SELECT user_id FROM users WHERE email/.test(sql)) return { rows: [] }
        if (/INSERT INTO users/.test(sql)) {
          if (insertThrows) { const e = new Error('dup'); e.code = '23505'; e.constraint = 'uq_users_id_number_hash'; throw e }
          capture.userParams = params
          return { rows: [{ user_id: 'u-new', email: 'new@example.com', role: 'member' }] }
        }
        if (/INSERT INTO user_profiles/.test(sql)) return {}
        return { rows: [] }
      }),
      release: vi.fn(),
    }
  }
  const base = { email: 'new@example.com', password: 'Password123', displayName: 'Neo', popiaConsent: true }

  it('201s with a valid ID and stores it ENCRYPTED (never the raw number)', async () => {
    const capture = {}
    pool.connect.mockResolvedValue(registerClient(capture))
    const res = await request(app).post('/auth/register').send({ ...base, idNumber: VALID })
    expect(res.status).toBe(201)
    // users INSERT params: […, id_number_enc, id_number_hash] are the last two.
    const enc = capture.userParams.at(-2), hash = capture.userParams.at(-1)
    expect(enc).toBeTruthy(); expect(hash).toBeTruthy()
    expect(enc).not.toContain(VALID)
    expect(hash).not.toContain(VALID)
    expect(JSON.stringify(res.body)).not.toContain(VALID) // never echoed back
  })
  it('422s a missing ID (required)', async () => {
    pool.connect.mockResolvedValue(registerClient({}))
    const res = await request(app).post('/auth/register').send(base)
    expect(res.status).toBe(422)
  })
  it('422s a Luhn-invalid ID', async () => {
    pool.connect.mockResolvedValue(registerClient({}))
    const res = await request(app).post('/auth/register').send({ ...base, idNumber: '8001015009088' })
    expect(res.status).toBe(422)
  })
  it('never echoes the raw ID (or password) back in the 422 body', async () => {
    pool.connect.mockResolvedValue(registerClient({}))
    const badId = '8001015009088' // Luhn-invalid, so validation fails and would reflect it
    const res = await request(app).post('/auth/register')
      .send({ ...base, password: 'Sup3rSecret!', idNumber: badId })
    expect(res.status).toBe(422)
    // express-validator reflects the offending `value` by default — check() must redact it.
    expect(JSON.stringify(res.body)).not.toContain(badId)
    expect(JSON.stringify(res.body)).not.toContain('Sup3rSecret!')
    // the field/message are still returned so the client can show useful feedback
    expect(JSON.stringify(res.body)).toMatch(/idNumber/)
  })
  it('409s a duplicate ID (unique index → friendly message)', async () => {
    pool.connect.mockResolvedValue(registerClient({}, { insertThrows: true }))
    const res = await request(app).post('/auth/register').send({ ...base, idNumber: VALID })
    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already registered/i)
  })
})
