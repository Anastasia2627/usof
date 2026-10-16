import dotenv from 'dotenv';
import { mailConfiguration, verifyMailConnection } from '../API/src/services/mailService.js';

dotenv.config();

const { configured, missing, host, port } = mailConfiguration();
if (!configured) {
  console.error('Circle SMTP is incomplete. Set these in .env:', missing.join(', '));
  process.exit(1);
}

try {
  await verifyMailConnection();
  console.log(`SMTP authentication successful with ${host}:${port}.`);
  console.log('This checks connection only; use npm run mail:send-test -- your@email.com to send a real test message.');
} catch (error) {
  console.error('SMTP connection or authentication failed:', error.code || error.message);
  process.exitCode = 1;
}
