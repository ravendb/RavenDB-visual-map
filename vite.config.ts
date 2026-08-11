import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://ravendb.github.io/RavenDB-visual-map/ via GitHub Pages.
  base: '/RavenDB-visual-map/',
})
