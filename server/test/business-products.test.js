// Batch 5 — business product catalog: owner-scoped CRUD + public read.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { authToken, mockDb } from './helpers.js'

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }))

const { pool } = await import('../db.js')
const app = (await import('../app.js')).default

const token = authToken({ userId: 'owner-1', role: 'business' })
const BIZ = 'biz-1'
const PROD = '11111111-1111-4111-8111-111111111111'

// Route the owner-business lookup + product statements. `owns` toggles whether the
// caller has a linked business.
function wire(handler = () => undefined, { owns = true } = {}) {
  mockDb(pool, (sql, params) => {
    if (/SELECT business_id FROM businesses WHERE owner_id/.test(sql)) return { rows: owns ? [{ business_id: BIZ }] : [] }
    return handler(sql, params)
  })
}

beforeEach(() => vi.clearAllMocks())

describe('GET /businesses/mine/products', () => {
  it('401s without a token', async () => {
    const res = await request(app).get('/businesses/mine/products')
    expect(res.status).toBe(401)
  })
  it('404s when no business is linked', async () => {
    wire(() => undefined, { owns: false })
    const res = await request(app).get('/businesses/mine/products').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
  it('returns the full catalog (incl. unavailable) for the owner', async () => {
    wire(sql => /SELECT \* FROM business_products WHERE business_id/.test(sql)
      ? { rows: [
          { product_id: PROD, business_id: BIZ, name: 'Flat white', description: null, price_cents: 3500, image_url: null, is_available: true, sort_order: 0, created_at: 't' },
          { product_id: 'p2', business_id: BIZ, name: 'Off-menu', description: null, price_cents: null, image_url: null, is_available: false, sort_order: 1, created_at: 't' },
        ] } : undefined)
    const res = await request(app).get('/businesses/mine/products').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(2)
    expect(res.body.products[0]).toMatchObject({ name: 'Flat white', price_cents: 3500 })
  })
})

describe('POST /businesses/mine/products', () => {
  it('creates an item (201) with a price', async () => {
    let inserted = null
    wire((sql, params) => {
      if (/SELECT COUNT\(\*\)::int AS n FROM business_products/.test(sql)) return { rows: [{ n: 3 }] }
      if (/INSERT INTO business_products/.test(sql)) { inserted = params; return { rows: [{ product_id: PROD, business_id: BIZ, name: params[1], description: params[2], price_cents: params[3], image_url: params[4], is_available: params[5], sort_order: params[6], created_at: 't' }] } }
    })
    const res = await request(app).post('/businesses/mine/products').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cappuccino', priceCents: 3200, description: 'Double shot' })
    expect(res.status).toBe(201)
    expect(res.body.product).toMatchObject({ name: 'Cappuccino', price_cents: 3200, is_available: true })
    expect(inserted[0]).toBe(BIZ) // scoped to the caller's business
  })
  it('allows a null price (price on request)', async () => {
    wire((sql, params) => {
      if (/COUNT/.test(sql)) return { rows: [{ n: 0 }] }
      if (/INSERT INTO business_products/.test(sql)) return { rows: [{ product_id: PROD, business_id: BIZ, name: params[1], description: null, price_cents: params[3], image_url: null, is_available: true, sort_order: 0, created_at: 't' }] }
    })
    const res = await request(app).post('/businesses/mine/products').set('Authorization', `Bearer ${token}`).send({ name: 'Custom cake' })
    expect(res.status).toBe(201)
    expect(res.body.product.price_cents).toBeNull()
  })
  it('422s a missing name', async () => {
    wire()
    const res = await request(app).post('/businesses/mine/products').set('Authorization', `Bearer ${token}`).send({ priceCents: 100 })
    expect(res.status).toBe(422)
  })
  it('422s a negative price', async () => {
    wire()
    const res = await request(app).post('/businesses/mine/products').set('Authorization', `Bearer ${token}`).send({ name: 'X', priceCents: -5 })
    expect(res.status).toBe(422)
  })
  it('422s when the catalog is full', async () => {
    wire(sql => /COUNT/.test(sql) ? { rows: [{ n: 100 }] } : undefined)
    const res = await request(app).post('/businesses/mine/products').set('Authorization', `Bearer ${token}`).send({ name: 'One too many' })
    expect(res.status).toBe(422)
    expect(res.body.message).toMatch(/limit/i)
  })
  it('404s when no business is linked', async () => {
    wire(() => undefined, { owns: false })
    const res = await request(app).post('/businesses/mine/products').set('Authorization', `Bearer ${token}`).send({ name: 'Ghost' })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /businesses/mine/products/:productId', () => {
  it('updates a field (200)', async () => {
    wire((sql, params) => /UPDATE business_products SET/.test(sql)
      ? { rows: [{ product_id: PROD, business_id: BIZ, name: 'Renamed', description: null, price_cents: 999, image_url: null, is_available: false, sort_order: 0, created_at: 't' }] } : undefined)
    const res = await request(app).patch(`/businesses/mine/products/${PROD}`).set('Authorization', `Bearer ${token}`)
      .send({ isAvailable: false, priceCents: 999 })
    expect(res.status).toBe(200)
    expect(res.body.product).toMatchObject({ is_available: false, price_cents: 999 })
  })
  it("404s a product that isn't in my business (ownership gate)", async () => {
    wire(sql => /UPDATE business_products SET/.test(sql) ? { rows: [] } : undefined) // WHERE business_id filters it out
    const res = await request(app).patch(`/businesses/mine/products/${PROD}`).set('Authorization', `Bearer ${token}`).send({ name: 'Hijack' })
    expect(res.status).toBe(404)
  })
  it('400s when there is nothing to update', async () => {
    wire()
    const res = await request(app).patch(`/businesses/mine/products/${PROD}`).set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).toBe(400)
  })
  it('422s a non-UUID product id', async () => {
    wire()
    const res = await request(app).patch('/businesses/mine/products/not-a-uuid').set('Authorization', `Bearer ${token}`).send({ name: 'X' })
    expect(res.status).toBe(422)
  })
})

describe('DELETE /businesses/mine/products/:productId', () => {
  it('deletes my product (204)', async () => {
    wire(sql => /DELETE FROM business_products/.test(sql) ? { rowCount: 1 } : undefined)
    const res = await request(app).delete(`/businesses/mine/products/${PROD}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
  })
  it("404s deleting someone else's product", async () => {
    wire(sql => /DELETE FROM business_products/.test(sql) ? { rowCount: 0 } : undefined)
    const res = await request(app).delete(`/businesses/mine/products/${PROD}`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /businesses/:id/products (public)', () => {
  const BIZID = '22222222-2222-4222-8222-222222222222'
  it('returns only available items for an active business', async () => {
    mockDb(pool, sql => {
      if (/SELECT status FROM businesses WHERE business_id/.test(sql)) return { rows: [{ status: 'active' }] }
      if (/is_available = TRUE/.test(sql)) return { rows: [{ product_id: PROD, business_id: BIZID, name: 'Latte', description: null, price_cents: 3000, image_url: null, is_available: true, sort_order: 0, created_at: 't' }] }
    })
    const res = await request(app).get(`/businesses/${BIZID}/products`)
    expect(res.status).toBe(200)
    expect(res.body.products).toHaveLength(1)
    expect(res.body.products[0].name).toBe('Latte')
  })
  it('404s for an inactive/missing business', async () => {
    mockDb(pool, sql => /SELECT status FROM businesses WHERE business_id/.test(sql) ? { rows: [{ status: 'pending' }] } : undefined)
    const res = await request(app).get(`/businesses/${BIZID}/products`)
    expect(res.status).toBe(404)
  })
  it('does not collide with /mine/products (mine is not treated as an id)', async () => {
    // hitting /mine/products without auth must 401 (owner route), not 422 (uuid check)
    const res = await request(app).get('/businesses/mine/products')
    expect(res.status).toBe(401)
  })
})
