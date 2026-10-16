import nodemailer from 'nodemailer';

let transporter;

// Credentials belong in the server's .env, never in React or the repository.
// Gmail: MAIL_HOST=smtp.gmail.com, MAIL_PORT=465, MAIL_USER=address@gmail.com,
// MAIL_PASSWORD=<Google app password>, MAIL_FROM=address@gmail.com.
function smtpConfig() {
  const host = String(process.env.MAIL_HOST || '').trim();
  const from = String(process.env.MAIL_FROM || '').trim();
  const user = String(process.env.MAIL_USER || '').trim();
  const password = String(process.env.MAIL_PASSWORD || '');
  const port = Number(process.env.MAIL_PORT || 587);
  const missing = [];
  if (!host) missing.push('MAIL_HOST');
  if (!from) missing.push('MAIL_FROM');
  if (!user) missing.push('MAIL_USER');
  if (!password) missing.push('MAIL_PASSWORD');
  if (!Number.isInteger(port) || port < 1 || port > 65535) missing.push('MAIL_PORT');
  return { host, from, user, password, port, missing };
}

function mailTransport() {
  const config = smtpConfig();
  if (config.missing.length) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      // For standard STARTTLS providers, do not send credentials in plaintext.
      requireTLS: config.port === 587,
      auth: { user: config.user, pass: config.password },
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

export function mailConfiguration() {
  const config = smtpConfig();
  // Only return safe metadata, NEVER credentials.
  return { configured: config.missing.length === 0, missing: config.missing, host: config.host, port: config.port };
}

export async function verifyMailConnection() {
  const transport = mailTransport();
  if (!transport) {
    throw new Error('SMTP is not configured. Missing: ' + smtpConfig().missing.join(', '));
  }
  await transport.verify();
}

function frontendOrigin() {
  return String(process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function send({ to, subject, text, html }) {
  const transport = mailTransport();
  if (!transport) return { configured: false, sent: false };
  try {
    const info = await transport.sendMail({
      from: smtpConfig().from,
      to,
      subject,
      text,
      html,
    });
    // Accepted means the SMTP server took responsibility, NOT that the
    // destination inbox has received it. Mail can still be filtered/bounced.
    return { configured: true, sent: info.accepted?.some(
      address => address.toLowerCase() === String(to).toLowerCase(),
    ) || false };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // Do not print SMTP credentials, message bodies, tokens or passwords.
      console.error('Circle email SMTP failure:', error.code || 'SMTP_ERROR', error.responseCode || '');
    }
    return { configured: true, sent: false };
  }
}

export async function sendVerificationEmail({ to, login, token, code }) {
  const url = `${frontendOrigin()}/#/verify/${encodeURIComponent(token)}`;
  return send({
    to,
    subject: 'Confirm your Circle email',
    text: [
      `Hi ${login},`,
      `Your Circle confirmation code: ${code}`,
      `Or confirm with this one-time link: ${url}`,
      'Both expire in 20 minutes. If you did not sign up, ignore this email.',
    ].join('\n\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#18202c">
        <h1 style="font-size:24px">Confirm your Circle email</h1>
        <p>Hello ${escapeHtml(login)},</p>
        <p>Enter this confirmation code:</p>
        <p style="font-size:32px;font-weight:bold;letter-spacing:5px">${escapeHtml(code)}</p>
        <p>Or <a href="${escapeHtml(url)}">confirm your email with one click</a>.</p>
        <p style="font-size:13px">Code and link expire in 20 minutes. If this wasn't you, ignore this message.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const url = `${frontendOrigin()}/#/reset/${encodeURIComponent(token)}`;
  return send({
    to,
    subject: 'Reset your Circle password',
    text: `Reset your Circle password using this one-time link (valid for 30 minutes):\n\n${url}\n\nIf you did not request this, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
      <h1>Reset your Circle password</h1>
      <p><a href="${escapeHtml(url)}">Choose a new password</a></p>
      <p>This link expires in 30 minutes. If you did not request a reset, ignore this email.</p>
    </div>`,
  });
}

export async function sendTestEmail(to) {
  return send({
    to,
    subject: 'Circle SMTP test — real message',
    text: 'This is a real test message sent by your Circle server through its configured SMTP provider.',
    html: '<p>This is a real test message sent by your <strong>Circle</strong> server through SMTP.</p>',
  });
}
