import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Relative, so the same build works at the root of a domain and under a GitHub Pages
  // project path (`/<repo>/`) without being rebuilt for either. See `src/lib/asset.ts`.
  base: './',
  // `host: true` exposes the dev server on your LAN so you can open it on a real phone.
  server: { host: true, port: 5173 },
})
