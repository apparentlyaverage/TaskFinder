// server/log.js — centralized structured logger (TD-7).
// One JSON object per line: easy to grep locally and to ship to a log
// aggregator in production. Never logs secrets or full request bodies.
//
//   log.info('user.login', { reqId, userId })
//   log.error('db.query_failed', { reqId, msg: err.message })
//
function emit(level, event, meta = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...meta })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info:  (event, meta) => emit('info', event, meta),
  warn:  (event, meta) => emit('warn', event, meta),
  error: (event, meta) => emit('error', event, meta),
}

export default log
