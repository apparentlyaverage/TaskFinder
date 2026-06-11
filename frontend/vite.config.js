import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // historyApiFallback ensures /oauth-callback serves index.html
    // so React can read the query params when Google redirects back
    historyApiFallback: true,
    proxy: {
      // ALL /auth routes proxy to the auth service on port 3001
      // This includes:
      //   /auth/google          → kicks off OAuth flow
      //   /auth/google/callback → Google redirects here, Vite forwards to auth service
      //   /auth/login           → local login
      //   /auth/register        → local register
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Other services — only needed when running full backend stack
      '/tasks':         { target: 'http://localhost:8080', changeOrigin: true },
      '/payments':      { target: 'http://localhost:8080', changeOrigin: true },
      '/messages':      { target: 'http://localhost:8080', changeOrigin: true },
      '/notifications': { target: 'http://localhost:8080', changeOrigin: true },
      '/matching':      { target: 'http://localhost:8080', changeOrigin: true },
      '/reviews':       { target: 'http://localhost:8080', changeOrigin: true },
      '/disputes':      { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
