import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Forward API calls to the Express backend, e.g. /api/books -> http://localhost:4000/api/books
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
