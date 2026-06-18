// server/test/setup.js — runs before any test module is imported.
// Provides the minimum env the app needs to even load:
//   • JWT_SECRET           — token signing/verification
//   • GOOGLE_* / FRONTEND  — passport-google-oauth20 strategy is constructed at
//                            import time and throws if clientID/secret/callback
//                            are missing.
// These are dummy values; tests never perform a real Google handshake.
process.env.NODE_ENV            = 'test'
process.env.JWT_SECRET         = process.env.JWT_SECRET || 'test_secret_at_least_32_chars_long_xxxxx'
process.env.JWT_EXPIRES_IN     = '7d'
process.env.FRONTEND_URL       = 'http://localhost:3000'
process.env.GOOGLE_CLIENT_ID     = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_CALLBACK_URL  = 'http://localhost:3001/auth/google/callback'
