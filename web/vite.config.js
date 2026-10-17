import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Browser -> Vite (5173) -> Node API (5000), always same-origin in development.
// This avoids browser CORS and localhost/127.0.0.1 resolution mismatches.
export default defineConfig({
  root: 'web',
  envDir: '..',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist' },
});
