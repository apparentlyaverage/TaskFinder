// Fail-fast environment validation (TD-8).
import { describe, it, expect } from 'vitest'
import { assertEnv } from '../env.js'

const good = {
  JWT_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgres://localhost/db',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_CALLBACK_URL: 'http://localhost/cb',
}

describe('assertEnv', () => {
  it('passes when all required vars are present and valid', () => {
    expect(() => assertEnv({ ...good })).not.toThrow()
  })

  it('throws when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...rest } = good
    expect(() => assertEnv(rest)).toThrow(/JWT_SECRET/)
  })

  it('throws when JWT_SECRET is shorter than 32 chars', () => {
    expect(() => assertEnv({ ...good, JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/)
  })

  it('throws when DATABASE_URL is missing, and lists every problem', () => {
    expect(() => assertEnv({ JWT_SECRET: good.JWT_SECRET })).toThrow(/DATABASE_URL/)
  })
})
