import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as fs from 'fs'

try {
  fs.writeFileSync('d:/dev/web/gestaoequiperogerio/test_run.txt', 'vite.config.ts executed at ' + new Date().toISOString())
} catch (e: any) {
  // Ignore
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@fullcalendar')) {
              return 'vendor-fullcalendar';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react-core';
            }
            return 'vendor-libs';
          }
        }
      }
    }
  }
})
