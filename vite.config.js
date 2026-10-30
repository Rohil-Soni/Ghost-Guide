import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages sub-paths as well as Vercel/Netlify roots.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
