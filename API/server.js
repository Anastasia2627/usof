import dotenv from 'dotenv';
import app from './app.js';
import { validateAuthConfiguration } from './src/middleware/auth.js';
import { pingDatabase, pool } from './src/config/db.js';

dotenv.config();

const port = Number(process.env.APP_PORT || 5050);
let server;

try {
  validateAuthConfiguration();
  await pingDatabase();
  server = app.listen(port, () => {
    console.log(`Circle API listening on http://127.0.0.1:${port}`);
  });
} catch (error) {
  console.error(
    'Cannot start API: check AUTH_SECRET and MySQL configuration, then run npm run db:init.',
  );
  console.error(error.message);
  process.exit(1);
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down Usof API.`);
  const forceTimer = setTimeout(() => process.exit(1), 5000);
  forceTimer.unref();
  server.close(async () => {
    try {
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
