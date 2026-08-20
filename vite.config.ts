import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Relative base so the built app works when served from a GitHub Pages
// project subpath (e.g. username.github.io/<repo>/) as well as from a
// domain root. All runtime asset loads go through import.meta.env.BASE_URL.
export default defineConfig({
  base: './',
  plugins: [react()],
})
