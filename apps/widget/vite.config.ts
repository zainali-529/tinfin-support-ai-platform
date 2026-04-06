import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3002 },
  define: {
    'import.meta.env.VITE_API_WS_URL': JSON.stringify(process.env.VITE_API_WS_URL || 'ws://localhost:3003')
  },
  build: {
    lib: {
      entry: 'src/main.ts',
      name: 'TinfinWidget',
      fileName: 'widget',
      formats: ['iife'],
    },
    rollupOptions: { external: [] },
    minify: 'esbuild',
  },
})