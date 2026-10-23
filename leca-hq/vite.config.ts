import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base relative : l'appli peut être servie à la racine ou dans un sous-dossier
// (hébergement statique gratuit type GitHub Pages / Netlify / Cloudflare Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: false,
  },
});
