import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Builds the full v2 app into public/v2/. Express's existing static
// middleware serves it at /v2/. base: '/v2/' so React Router's
// browser history mode and the asset URLs both resolve correctly when
// the bundle is hosted from that path.
export default defineConfig({
  root: __dirname,
  base: '/v2/',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../public/v2'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
