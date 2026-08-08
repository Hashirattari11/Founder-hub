import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) return 'three'
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdf-lib')) return 'pdf'
            if (id.includes('react-router')) return 'router'
            if (id.includes('framer-motion')) return 'motion'
            if (id.includes('react-hot-toast')) return 'toast'
            if (id.includes('react-helmet-async')) return 'helmet'
            if (
              id.includes('react') ||
              id.includes('scheduler') ||
              id.includes('react-dom')
            ) {
              return 'react'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
