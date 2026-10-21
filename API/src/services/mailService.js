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


function emailShell({ eyebrow, heading, intro, primary, secondary = '', footer = '' }) {
  return `
  <!doctype html>
  <html lang="uk">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f6f5f7;font-family:Arial,Helvetica,sans-serif;color:#211f23">
    <div style="display:none;font-size:1px;max-height:0;overflow:hidden;opacity:0">${escapeHtml(eyebrow)} — Circle</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f7">
      <tr><td align="center" style="padding:38px 16px 52px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
          style="max-width:530px;background:#ffffff;border:1px solid #eae7ec;border-radius:22px">
          <tr><td style="padding:35px 38px 8px">
            <span style="font-size:24px;font-weight:800;letter-spacing:-1.5px;color:#1c1b1e">
              <span style="font-size:25px;font-weight:400;vertical-align:-1px">◎</span> circle
            </span>
          </td></tr>
          <tr><td style="padding:32px 38px 4px">
            <div style="color:#9877b2;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">
              ${escapeHtml(eyebrow)}
            </div>
            <h1 style="font-family:Arial,Helvetica,sans-serif;font-size:31px;line-height:1.18;letter-spacing:-1.1px;color:#211f23;margin:17px 0 12px;font-weight:800">
              ${escapeHtml(heading)}
            </h1>
            <p style="font-size:15px;line-height:1.65;color:#68636d;margin:0 0 24px">
              ${escapeHtml(intro)}
            </p>
          </td></tr>
          <tr><td style="padding:0 38px">${primary}</td></tr>
          ${secondary ? `<tr><td style="padding:23px 38px 5px">${secondary}</td></tr>` : ''}
          <tr><td style="padding:26px 38px 34px">
            <p style="font-size:12px;line-height:1.6;color:#99919e;margin:0">
              ${escapeHtml(footer)}
            </p>
          </td></tr>
        </table>
        <p style="font-size:12px;color:#99929d;margin:20px 0 0">Circle · Спільнота твоїх інтересів</p>
      </td></tr>
    </table>
  </body></html>`;
}

export async function sendVerificationEmail({ to, login, token, code }) {
  const url = `${frontendOrigin()}/#/verify/${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(url);
  const safeCode = escapeHtml(String(code).replace(/[^0-9]/g,''));
  const safeLogin = escapeHtml(login);
  const html = emailShell({
    eyebrow: 'Підтвердження пошти',
    heading: 'Ще один крок — і ти в Circle',
    intro: `Привіт, ${login}! Введи код нижче, щоб підтвердити свою електронну адресу`,
    primary: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid #e5d9ed;background:#f7f1fb;border-radius:16px">
        <tr><td align="center" style="padding:26px 12px">
          <div style="font-size:11px;color:#81718e;letter-spacing:1.4px;font-weight:700;text-transform:uppercase;margin-bottom:12px">
            Твій код підтвердження
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:800;letter-spacing:9px;line-height:1.1;color:#29212f">
            ${safeCode}
          </div>
          <div style="font-size:12px;color:#897b91;margin-top:14px">Дійсний протягом 20 хвилин</div>
        </td></tr>
      </table>`,
    secondary: `<p style="font-size:13px;line-height:1.6;color:#89828d;margin:0 0 13px;text-align:center">
      Або підтвердь адресу одним натисканням
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
      <tr><td style="border-radius:40px;background:#242127">
        <a href="${safeUrl}" style="display:inline-block;padding:14px 27px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">
          Підтвердити пошту &rarr;
        </a>
      </td></tr>
    </table>`,
    footer: 'Якщо ти не реєструвалася або не реєструвався в Circle, просто проігноруй цей лист',
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
