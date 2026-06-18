// server/env.js — fail-fast environment validation (TD-8).
// Importing app.js constructs the Google OAuth strategy and signs JWTs; if the
// required secrets are missing we want a clear boot-time error, not a cryptic
// runtime crash on the first request. Call assertEnv() before loading the app.
const REQUIRED = {
  JWT_SECRET:           v => typeof v === 'string' && v.length >= 32,
  DATABASE_URL:         v => !!v,
  GOOGLE_CLIENT_ID:     v => !!v,
  GOOGLE_CLIENT_SECRET: v => !!v,
  GOOGLE_CALLBACK_URL:  v => !!v,
}

const HINTS = {
  JWT_SECRET: 'must be set and at least 32 characters',
}

export function assertEnv(env = process.env) {
  const problems = []
  for (const [key, isValid] of Object.entries(REQUIRED)) {
    if (!isValid(env[key])) {
      problems.push(`  - ${key}: ${HINTS[key] || 'is required but missing'}`)
    }
  }
  if (problems.length) {
    throw new Error(
      `Invalid environment — refusing to start:\n${problems.join('\n')}\n` +
      `Set these in server/.env (see .env.example).`
    )
  }
}

export default assertEnv
