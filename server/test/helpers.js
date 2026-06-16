// Shared test helpers. requireAuth now does a token_version lookup as the first
// query on every authenticated route, so tests route DB responses by SQL (robust
// to call order) and auto-answer that lookup.
import jwt from 'jsonwebtoken'

export function authToken(overrides = {}) {
  return jwt.sign({ userId: 'u-1', role: 'member', tv: 0, ...overrides }, process.env.JWT_SECRET)
}

// pool: the mocked pool. handler: (sql, params) => response | undefined.
// The token_version lookup and any unmatched query default sensibly.
export function mockDb(pool, handler = () => undefined) {
  pool.query.mockImplementation(async (sql, params) => {
    if (/SELECT token_version FROM users WHERE user_id/.test(sql)) {
      return { rows: [{ token_version: 0 }] }
    }
    const r = handler(sql, params)
    return r === undefined ? { rows: [] } : r
  })
}

// A transaction client whose query() is routed by SQL. release/BEGIN/COMMIT/
// ROLLBACK are handled; pass a handler for the meaningful statements.
export function mockClient(handler = () => undefined) {
  return {
    query: async (sql, params) => {
      if (/BEGIN|COMMIT|ROLLBACK/.test(sql)) return {}
      const r = handler(sql, params)
      return r === undefined ? { rows: [] } : r
    },
    release: () => {},
  }
}
