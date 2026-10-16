import dotenv from 'dotenv';
import { mailConfiguration, sendTestEmail } from '../API/src/services/mailService.js';

dotenv.config();

const to = String(process.argv[2] || '').trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: npm run mail:send-test -- recipient@example.com');
  process.exit(1);
}

const config = mailConfiguration();
if (!config.configured) {
  console.error('Cannot send: complete SMTP settings in .env first:', config.missing.join(', '));
  process.exit(1);
}

const result = await sendTestEmail(to);
if (!result.sent) {
  console.error('SMTP did not accept the message. Check MAIL_HOST/PORT/USER/PASSWORD/FROM and try mail:check.');
  process.exitCode = 1;
} else {
  console.log(`SMTP accepted the test email for ${to}.`);
  console.log('Check the recipient inbox and Spam folder to confirm final delivery.');
}
