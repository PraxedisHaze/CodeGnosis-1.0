import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Prevent vite from obscuring rust errors
  clearScreen: false,

  // Auto-find available port (from VITE_PORT)
  server: {
    port: Number(process.env.VITE_PORT || 1420),
    strictPort: true,
  },

  // Environment variables for Tauri
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // Tauri uses Chromium
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
