import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = new URL('.', import.meta.url).pathname;
const shared = new URL('../../../../shared', import.meta.url).pathname;
const outDir = new URL('../../../../tmp/art-gallery', import.meta.url).pathname;

export default defineConfig({
  root: here,
  base: './',
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: `${here}gallery.html` },
  },
});
