import nodemailer from 'nodemailer';

let transporter;

function smtpConfigured() {
  return Boolean(process.env.MAIL_HOST && process.env.MAIL_PORT);
}

function getTransporter() {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.MAIL_PORT || 587);
    const config = {
      host: process.env.MAIL_HOST,
      port,
      secure: port === 465,
    };
    if (process.env.MAIL_USER || process.env.MAIL_PASSWORD) {
      config.auth = {
        user: process.env.MAIL_USER || '',
        pass: process.env.MAIL_PASSWORD || '',
      };
    }
    transporter = nodemailer.createTransport(config);
  }
  return transporter;
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
  const transport = getTransporter();
  if (!transport) return { configured: false, sent: false };
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'Circle@example.local',
      to,
      subject,
      text,
      html,
    });
    return { configured: true, sent: true };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('Email delivery failed:', error.message);
    return { configured: true, sent: false };
  }
}

export async function sendVerificationEmail({ to, login, token, code }) {
  const url = `${frontendOrigin()}/#/verify/${encodeURIComponent(token)}`;
  const safeLogin = escapeHtml(login);
  const safeUrl = escapeHtml(url);
  const safeCode = escapeHtml(code);

  return send({
    to,
    subject: 'Your Circle verification code',
    text: [
      `Hello ${login}.`,
      `Your Circle verification code is ${code}.`,
      `Or verify instantly with this one-time link: ${url}`,
      'The code and link expire in 20 minutes and can only be used once.',
    ].join('\\n\\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#171519">
        <p style="font-size:14px;color:#6f6972">Hello ${safeLogin}.</p>
        <h1 style="font-size:32px;margin:12px 0">Welcome to Circle.</h1>
        <p>Use this code to verify your email:</p>
        <p style="font-size:38px;letter-spacing:8px;font-weight:700;margin:22px 0">${safeCode}</p>
        <p style="margin:28px 0">
          <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#7048e8;color:#fff;text-decoration:none;border-radius:10px">
            Verify instantly
          </a>
        </p>
        <p style="font-size:12px;color:#7d7580">The code and link expire in 20 minutes and can only be used once.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const url = `${frontendOrigin()}/#/reset/${encodeURIComponent(token)}`;
  return send({
    to,
    subject: 'Reset your Circle password',
    text: `Reset your Circle password: ${url}`,
    html: `<p>Use this link to reset your Circle password:</p><p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
  });
}
