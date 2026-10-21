import nodemailer from 'nodemailer';
import { validateEmail } from '../utils/validation.js';

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
  validateEmail(to);
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
    // Log only SMTP error metadata, never recipients, codes or email bodies
    console.error(JSON.stringify({
      event:'mail_delivery_failed',
      code:error.code || 'SMTP_ERROR',
      smtpStatus:error.responseCode || null,
    }));
    return { configured: true, sent: false };
  }
}


function emailShell({ eyebrow, heading, intro, primary, secondary = '', footer = '' }) {
  return `
<!doctype html>
<html lang="uk">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f6;color:#211e24;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f5f4f6">
    ${escapeHtml(eyebrow)} — Circle
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f4f6">
    <tr><td align="center" style="padding:44px 16px 48px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="width:100%;max-width:540px;background:#fff;border:1px solid #e7e4e9;border-radius:18px">
        <tr><td style="padding:35px 40px 30px;border-bottom:1px solid #f0eef2">
          <span style="color:#1b191f;font-size:26px;font-weight:800;letter-spacing:-1.5px;line-height:1">
            <span style="font-size:30px;font-weight:400;vertical-align:-2px;margin-right:2px">◎</span>circle
          </span>
        </td></tr>
        <tr><td style="padding:35px 40px 0">
          <p style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#80659a;margin:0 0 17px;text-transform:uppercase">
            ${escapeHtml(eyebrow)}
          </p>
          <h1 style="font-size:31px;line-height:1.17;letter-spacing:-1.25px;font-weight:800;color:#201c24;margin:0 0 15px">
            ${escapeHtml(heading)}
          </h1>
          <p style="font-size:15px;line-height:1.7;color:#716a76;margin:0 0 29px">
            ${escapeHtml(intro)}
          </p>
        </td></tr>
        <tr><td style="padding:0 40px">${primary}</td></tr>
        ${secondary ? `<tr><td style="padding:27px 40px 0">${secondary}</td></tr>` : ''}
        <tr><td style="padding:32px 40px 36px">
          <p style="margin:0;padding-top:22px;border-top:1px solid #f0eef2;color:#9b949f;font-size:12px;line-height:1.65">
            ${escapeHtml(footer)}
          </p>
        </td></tr>
      </table>
      <p style="font-size:12px;color:#a29ba5;margin:18px 0 0">Circle · Місце для твоїх захоплень</p>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendVerificationEmail({ to, login, token, code }) {
  const url = `${frontendOrigin()}/#/verify/${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(url);
  const safeCode = escapeHtml(String(code).replace(/[^0-9]/g,''));
  // All user-provided text goes through emailShell's escaping before HTML output
  const html = emailShell({
    eyebrow: 'Підтвердження електронної пошти',
    heading: 'Підтвердь свою пошту',
    intro: `Привіт, ${String(login||'').trim()}! Щоб завершити реєстрацію у Circle, введи цей код на сторінці підтвердження`,
    primary: `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="background:#f5f0fa;border:1px solid #ebe0f4;border-radius:14px">
        <tr><td align="center" style="padding:30px 12px 27px">
          <p style="margin:0 0 17px;font-size:11px;line-height:1.4;color:#896c9c;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">
            Код підтвердження
          </p>
          <p style="margin:0;font-size:38px;line-height:1.1;font-weight:800;letter-spacing:7px;color:#291f30;font-variant-numeric:tabular-nums">
            ${safeCode}
          </p>
          <p style="margin:19px 0 0;font-size:12px;color:#82768e">
            Код діє 20 хвилин
          </p>
        </td></tr>
      </table>`,
    secondary: `
      <p style="margin:0 0 16px;color:#8c8590;font-size:13px;line-height:1.5;text-align:center">
        Або підтвердь адресу одним натисканням
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
        <tr><td align="center" style="border-radius:999px;background:#232027">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 26px;text-decoration:none;color:#fff;font-size:13px;font-weight:700">
            Підтвердити пошту &rarr;
          </a>
        </td></tr>
      </table>`,
    footer: 'Якщо ти не створювала або не створював акаунт у Circle, можеш просто проігнорувати цей лист',
  });
  return send({
    to, subject: 'Circle — твій код підтвердження',
    text: [
      `Привіт, ${login}!`,
      `Код підтвердження Circle: ${code}`,
      'Дійсний протягом 20 хвилин',
      `Або перейди за посиланням: ${url}`,
      'Якщо це не ти, проігноруй повідомлення',
    ].join('\n\n'),
    html,
  });
}

export async function sendPasswordResetEmail({ to, token }) {
  const url = `${frontendOrigin()}/#/reset/${encodeURIComponent(token)}`;
  const html = emailShell({
    eyebrow: 'Безпека акаунта',
    heading: 'Відновлення пароля',
    intro: 'Отримали запит на зміну пароля Circle — якщо це ти, переходь за посиланням',
    primary: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr><td style="border-radius:40px;background:#242127">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:15px 29px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">
          Створити новий пароль &rarr;
        </a>
      </td></tr></table>`,
    footer: 'Посилання діє 30 хвилин — якщо ти не запитувала або не запитував відновлення, проігноруй цей лист',
  });
  return send({
    to, subject: 'Circle — відновлення пароля',
    text: `Відновити пароль Circle (посилання дійсне 30 хвилин):\n\n${url}\n\nЯкщо це не ти, проігноруй лист`,
    html,
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
