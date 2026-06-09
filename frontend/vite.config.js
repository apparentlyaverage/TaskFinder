import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/auth':          'http://localhost:8080',
      '/tasks':         'http://localhost:8080',
      '/payments':      'http://localhost:8080',
      '/messages':      'http://localhost:8080',
      '/notifications': 'http://localhost:8080',
      '/matching':      'http://localhost:8080',
      '/reviews':       'http://localhost:8080',
      '/disputes':      'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
