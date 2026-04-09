import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/auth':          { target: 'http://localhost:8080', changeOrigin: true },
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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          api:    ['axios'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
})
