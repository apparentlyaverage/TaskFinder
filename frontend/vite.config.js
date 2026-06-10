import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // During local Google OAuth testing, auth goes directly to the auth service
      // so we don't need the gateway running
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Everything else goes through the gateway (only needed if gateway is running)
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
