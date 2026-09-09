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

async function send({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) return { configured: false, sent: false };
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'usof@example.local',
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

export async function sendVerificationEmail({ to, login, token }) {
  const url = `${frontendOrigin()}/#/verify/${encodeURIComponent(token)}`;
  return send({
    to,
    subject: 'Verify your Usof email',
    text: `Hello ${login}. Verify your Usof account: ${url}`,
    html: `<p>Hello ${login}.</p><p>Verify your Usof account:</p><p><a href="${url}">${url}</a></p>`,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const url = `${frontendOrigin()}/#/reset/${encodeURIComponent(token)}`;
  return send({
    to,
    subject: 'Reset your Usof password',
    text: `Reset your Usof password: ${url}`,
    html: `<p>Use this link to reset your Usof password:</p><p><a href="${url}">${url}</a></p>`,
  });
}
