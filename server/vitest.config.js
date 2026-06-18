import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Set dummy env BEFORE any test module (and therefore app.js / the Google
    // strategy, which is constructed at import time) is evaluated.
    setupFiles: ['./test/setup.js'],
    // Each test FILE gets a fresh module registry, so rate-limiter state and
    // db mocks never leak between files.
    isolate: true,
  },
})
