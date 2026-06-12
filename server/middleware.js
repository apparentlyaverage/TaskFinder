// server/middleware.js
// SECURITY: the old microservices trusted an x-user-id header set by the
// gateway. Without a gateway that header is spoofable. This middleware
// verifies the JWT itself and sets req.userId / req.userRole.
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentication required.' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId   = payload.userId
    req.userRole = payload.role
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

export function handleValidation(req, res, next) {
  // imported lazily to keep middleware dependency-free at top level
  const { validationResult } = req.app.locals.validator
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() })
  next()
}
