import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All API routes proxy to the unified server on port 3001.
// Run the backend with:  cd server && npm run dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 3000,
    historyApiFallback: true,
    proxy: {
      // 4s was too aggressive: a cold Neon (serverless Postgres) connection can
      // push the first /auth/me past it, the proxy then errors, and the client
      // restore logic clears the token — silently logging the user out on reload.
      // 20s tolerates cold starts. (Prod is unaffected: Vercel calls Railway directly.)
      '/auth':          { target: 'http://localhost:3001', changeOrigin: true, proxyTimeout: 20000, timeout: 20000 },
      '/tasks':         { target: 'http://localhost:3001', changeOrigin: true },
      '/messages':      { target: 'http://localhost:3001', changeOrigin: true },
      '/notifications': { target: 'http://localhost:3001', changeOrigin: true },
      '/reviews':       { target: 'http://localhost:3001', changeOrigin: true },
      '/profile':       { target: 'http://localhost:3001', changeOrigin: true },
      '/businesses':    { target: 'http://localhost:3001', changeOrigin: true },
      '/locations':     { target: 'http://localhost:3001', changeOrigin: true },
      '/disputes':      { target: 'http://localhost:3001', changeOrigin: true },
      '/search':        { target: 'http://localhost:3001', changeOrigin: true },
      '/categories':    { target: 'http://localhost:3001', changeOrigin: true },
      '/templates':     { target: 'http://localhost:3001', changeOrigin: true },
      '/admin':         { target: 'http://localhost:3001', changeOrigin: true },
      '/flags':         { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads':       { target: 'http://localhost:3001', changeOrigin: true },
      '/deals':         { target: 'http://localhost:3001', changeOrigin: true },
      '/follows':       { target: 'http://localhost:3001', changeOrigin: true },
      '/scheduling':    { target: 'http://localhost:3001', changeOrigin: true },
      '/retainers':     { target: 'http://localhost:3001', changeOrigin: true },
      '/push':          { target: 'http://localhost:3001', changeOrigin: true },
      '/availability':  { target: 'http://localhost:3001', changeOrigin: true },
      '/feedback':      { target: 'http://localhost:3001', changeOrigin: true },
      '/waitlist':      { target: 'http://localhost:3001', changeOrigin: true },
      '/health':        { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split stable third-party code into its own long-cached chunk so a
        // change to app code doesn't force browsers to re-download React etc.
        // (Route-level splitting of App.jsx is a larger follow-up — it's one
        // component today.) This trims the initial app chunk and improves the
        // cache-hit rate on repeat visits, helping Core Web Vitals.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'qrcode': ['qrcode'],
        },
      },
    },
  },
})
