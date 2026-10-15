import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const host = process.env.MAIL_HOST;
const port = Number(process.env.MAIL_PORT || 587);
const user = process.env.MAIL_USER;
const password = process.env.MAIL_PASSWORD;

if (!host) {
  console.error('MAIL_HOST is missing. Configure SMTP in .env first.');
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('MAIL_PORT must be a valid SMTP port.');
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host, port,
  secure: port === 465,
  ...(user || password ? { auth: { user: user || '', pass: password || '' } } : {}),
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

try {
  await transport.verify();
  console.log('SMTP connection and authentication succeeded.');
  console.log('This does NOT prove delivery to an inbox. Register a new account to test the full verification flow.');
} catch (error) {
  console.error('SMTP check failed:', error.message);
  process.exitCode = 1;
} finally {
  transport.close();
}
