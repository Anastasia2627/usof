import dotenv from 'dotenv';
import app from './app.js';
import { pingDatabase, pool } from './src/config/db.js';

dotenv.config();

const port = Number(process.env.APP_PORT || 5000);
let server;

try {
  await pingDatabase();
  server = app.listen(port, () => {
    console.log(`Usof API listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error(
    'Cannot start API: MySQL connection failed. Run npm run db:init after configuring .env.',
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
