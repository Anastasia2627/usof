import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The frontend reads APP_PORT from the SAME root .env as API/server.js.
// This avoids port drift and bypasses macOS AirPlay Receiver on port 5000.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const apiPort = Number(env.APP_PORT || 5050);
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error('APP_PORT must be a valid TCP port in your root .env');
  }
  const backend = `http://127.0.0.1:${apiPort}`;
  return {
    root: 'web',
    envDir: '..',
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/uploads': { target: backend, changeOrigin: true },
      },
    },
    build: { outDir: 'dist' },
  };
});
