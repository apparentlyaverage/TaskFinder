// server/middleware.js
// SECURITY: the old microservices trusted an x-user-id header set by the
// gateway. Without a gateway that header is spoofable. This middleware
// verifies the JWT itself and sets req.userId / req.userRole.
//
// TD-5: JWTs are also checked against the user's current token_version, so a
// token can be revoked before it expires (logout / password change bump the
// version). Tokens issued before this feature carry no `tv` claim and are
// treated as version 0 for continuity.
import jwt from 'jsonwebtoken'
import { pool } from './db.js'
import log from './log.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentication required.' })

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT token_version FROM users WHERE user_id = $1', [payload.userId])
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid or expired token.' })
    const tokenVersion = payload.tv ?? 0
    if (rows[0].token_version !== tokenVersion) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' })
    }
  } catch (err) {
    log.error('auth.token_version_check_failed', { reqId: req.id, msg: err.message })
    return res.status(503).json({ message: 'Service temporarily unavailable.' })
  }

  req.userId   = payload.userId
  req.userRole = payload.role
  next()
}

// Admin gate — runs after requireAuth (which sets req.userRole from the JWT).
export function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ message: 'Admin access required.' })
  next()
}

export function handleValidation(req, res, next) {
  // imported lazily to keep middleware dependency-free at top level
  const { validationResult } = req.app.locals.validator
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}
