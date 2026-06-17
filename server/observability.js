// server/observability.js — central error capture (§7.7).
// Logs structured errors now; ready for an error-tracking dashboard. Set
// SENTRY_DSN and wire @sentry/node where marked to ship to Sentry (same
// provider-stub pattern as email.js). Until then errors are captured in the
// structured logs, which is already greppable/shippable to any aggregator.
import log from './log.js'

export function captureException(err, context = {}) {
  const e = err instanceof Error ? err : new Error(String(err))
  log.error('exception', {
    msg: e.message,
    stack: e.stack?.split('\n').slice(0, 4).join(' | '),
    ...context,
  })
  // TODO(sentry): if (process.env.SENTRY_DSN) Sentry.captureException(e, { extra: context })
}

// Catch otherwise-silent crashes. An uncaught exception leaves the process in an
// undefined state, so we log and exit (a supervisor/Railway restarts it).
export function installCrashHandlers() {
  process.on('unhandledRejection', (reason) => {
    captureException(reason, { kind: 'unhandledRejection' })
  })
  process.on('uncaughtException', (err) => {
    captureException(err, { kind: 'uncaughtException' })
    process.exit(1)
  })
}

export default captureException
