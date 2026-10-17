import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfigFromFile } from 'vite';

// Verify that frontend and backend can choose a port other than macOS AirPlay 5000.
const before = process.env.APP_PORT;
try {
  process.env.APP_PORT = '5050';
  const result = await loadConfigFromFile(
    { command: 'serve', mode: 'development' },
    path.resolve('web/vite.config.js'),
    process.cwd(),
    'error',
  );
  assert.ok(result?.config, 'Vite config not loaded');
  assert.equal(result.config.server.proxy['/api'].target, 'http://127.0.0.1:5050');
  assert.equal(result.config.server.proxy['/uploads'].target, 'http://127.0.0.1:5050');
  console.log('Vite forwards API and uploads to APP_PORT=5050 correctly.');
} finally {
  if (before === undefined) delete process.env.APP_PORT;
  else process.env.APP_PORT = before;
}
