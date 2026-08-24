import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Empêche Vite d'invoquer des ressources distantes hors build (privacy)
  clearScreen: false,
  envPrefix: ['VITE_'],
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
})