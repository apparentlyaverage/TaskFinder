// Signed Cloudinary upload signature endpoint: auth-gated, 503 when unconfigured,
// ownership-locked folder, and a verifiable signature when configured.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'
import { signParams } from '../cloudinary.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BIZ   = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ownerToken = authToken({ userId: OWNER, role: 'business' })
const adminToken = authToken({ userId: 'admin-1', role: 'admin' })

beforeEach(() => vi.clearAllMocks())

describe('POST /uploads/signature — not configured', () => {
  it('503s when Cloudinary env is missing', async () => {
    mockDb(pool)
    const res = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(503)
  })
})

describe('POST /uploads/signature — configured', () => {
  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'relivr-test'
    process.env.CLOUDINARY_API_KEY    = '123456789'
    process.env.CLOUDINARY_API_SECRET = 'shhh-secret'
    delete process.env.CLOUDINARY_UPLOAD_PRESET
  })
  afterEach(() => {
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
  })

  it('401s without a token', async () => {
    const res = await request(app).post('/uploads/signature')
    expect(res.status).toBe(401)
  })

  it('403s when the owner has no linked business', async () => {
    mockDb(pool, sql => { if (/FROM businesses WHERE owner_id/.test(sql)) return { rows: [] } })
    const res = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(403)
  })

  it('returns a signature locked to the owner\'s own folder', async () => {
    mockDb(pool, sql => { if (/FROM businesses WHERE owner_id/.test(sql)) return { rows: [{ business_id: BIZ }] } })
    const res = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.cloudName).toBe('relivr-test')
    expect(res.body.apiKey).toBe('123456789')
    expect(res.body.folder).toBe(`relivr/businesses/${BIZ}`)
    expect(res.body.allowedFormats).toBe('jpg,jpeg,png,webp,gif')
    // The signature must verify against the exact params the browser echoes back.
    const expected = signParams({
      folder: res.body.folder,
      timestamp: res.body.timestamp,
      allowed_formats: res.body.allowedFormats,
    }, 'shhh-secret')
    expect(res.body.signature).toBe(expected)
  })

  it('lets an admin target a specific business folder', async () => {
    mockDb(pool)
    const res = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${adminToken}`)
      .send({ businessId: BIZ })
    expect(res.status).toBe(200)
    expect(res.body.folder).toBe(`relivr/businesses/${BIZ}`)
  })

  it('falls back to an _admin scratch folder for a new (id-less) listing', async () => {
    mockDb(pool)
    const res = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.folder).toBe('relivr/businesses/_admin')
  })

  it('rejects a path-injection businessId by using the scratch folder', async () => {
    mockDb(pool)
    const res = await request(app).post('/uploads/signature').set('Authorization', `Bearer ${adminToken}`)
      .send({ businessId: '../../etc/passwd' })
    expect(res.status).toBe(200)
    expect(res.body.folder).toBe('relivr/businesses/_admin')
  })
})
