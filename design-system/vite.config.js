import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The design system builds into the main app's public/design/ folder
// so Express's existing static middleware serves it at /design/.
// base: './' keeps asset paths relative to the HTML so Vite doesn't
// hardcode /assets/... at the root.
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public/design'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
