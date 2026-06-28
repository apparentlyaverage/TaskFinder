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

// Optional at launch, required once a feature goes live. Missing values are
// warned about (not fatal) so the server still boots — e.g. payments are
// planned for Month 2, so PAYSTACK_SECRET_KEY is not required on day one.
const OPTIONAL = {
  PAYSTACK_SECRET_KEY: 'required before enabling payments (live Month 2). Without it, /payments/* will fail.',
  RESEND_API_KEY:      'email provider (option B, needs a verified domain). Without GMAIL_* or this, emails are stubbed/logged only.',
  SENTRY_DSN:          'recommended for error tracking in production.',
  CLOUDINARY_CLOUD_NAME:  'required for business image uploads. Without it, /uploads/signature returns 503.',
  CLOUDINARY_API_KEY:     'required for business image uploads (paired with CLOUDINARY_API_SECRET).',
  CLOUDINARY_API_SECRET:  'required for business image uploads — used to sign uploads server-side.',
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

  // Non-fatal: surface missing optional keys so deploys are deliberate.
  // Skipped under test to keep the suite output clean.
  if (process.env.NODE_ENV !== 'test') {
    for (const [key, hint] of Object.entries(OPTIONAL)) {
      if (!env[key]) console.warn(`[env] ${key} is not set — ${hint}`)
    }
  }
}

export default assertEnv
