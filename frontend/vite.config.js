import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All API routes proxy to the unified server on port 3001.
// Run it with:  cd server && npm run dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    historyApiFallback: true,
    proxy: {
      '/auth':          { target: 'http://localhost:3001', changeOrigin: true },
      '/tasks':         { target: 'http://localhost:3001', changeOrigin: true },
      '/messages':      { target: 'http://localhost:3001', changeOrigin: true },
      '/notifications': { target: 'http://localhost:3001', changeOrigin: true },
      '/reviews':       { target: 'http://localhost:3001', changeOrigin: true },
      '/health':        { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
})
