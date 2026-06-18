// server/index.js — thin entrypoint: load env, validate it, then start the app.
// Validation runs BEFORE app.js is imported (dynamic import) because importing
// the app constructs the Google strategy and would otherwise crash cryptically
// on missing secrets. All Express wiring lives in app.js so it's testable.
import 'dotenv/config'
import assertEnv from './env.js'
import log from './log.js'
import { installCrashHandlers } from './observability.js'

installCrashHandlers()

try {
  assertEnv()
} catch (err) {
  // Don't use the JSON logger here — a human is reading this at boot.
  console.error('\n' + err.message + '\n')
  process.exit(1)
}

const { default: app } = await import('./app.js')
const { startScheduler } = await import('./jobs.js')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  log.info('server.started', {
    port: Number(PORT),
    frontend: FRONTEND_URL,
    db: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'NOT SET',
  })
  startScheduler() // expire overdue tasks periodically
})
