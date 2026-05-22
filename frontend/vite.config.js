import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Unified local gateway (nginx :8080) — api-service + evaluation service
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/reports': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
