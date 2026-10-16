# Real email delivery for Circle

This branch uses **Nodemailer with authenticated SMTP** in the Node.js backend.
Verification and password-reset emails are sent through the provider configured
in your server-side `.env`. This is not browser-only mock mail.

## 1. Connect a Gmail sender

Use a Gmail account that will **send** Circle messages. Enable two-step verification
and create an app password for Circle at:
https://myaccount.google.com/apppasswords

Google's current instructions:
https://support.google.com/mail/answer/185833

An app password is NOT your normal Gmail login password. It may be unavailable
on some Workspace, school or advanced-protection accounts. If unavailable, use
another email provider's SMTP credentials, or a provider supporting OAuth2.

Edit the **existing, uncommitted** `.env` in your Mac project, and set:

```dotenv
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_USER=your-sender@gmail.com
MAIL_PASSWORD=your-16-character-Google-app-password
MAIL_FROM=your-sender@gmail.com
CLIENT_ORIGIN=http://localhost:5173
```

Replace both email placeholders with the SAME real sender email. Replace the
password placeholder with the app password (without presentation spaces).
Use `465` for implicit TLS. The backend also supports `587` with required STARTTLS.
Do not paste passwords into a chat, commit `.env`, or put credentials in `VITE_*` variables.

For another SMTP provider, use its host, port and SMTP credentials.
Your `MAIL_FROM` must be a sender address that provider permits.

## 2. Actually send a test email — no MySQL needed

From the project directory:

```bash
npm run mail:check
npm run mail:send-test -- your-personal-inbox@gmail.com
```

The first command checks that SMTP connects and authenticates; it does NOT
send anything. The second sends a **real message** through the same
Nodemailer transport Circle uses for registration. You should see:
`SMTP accepted the test email`.

Then open the recipient mailbox and check **Inbox and Spam**. The SMTP
server accepting a message does not guarantee it reached the inbox: the
message can still be rejected, bounced or filtered later.

**Important for this Mac:** The current Homebrew MySQL data directory was
created by 9.6.0 but the active MySQL binary is 26.7.0. That incompatibility
and the unavailable root password are separate from email sending.
Do NOT run `db:reset`, initialize a new database over the existing one, or
delete the data directory to troubleshoot email. `mail:check` and
`mail:send-test` are independent of MySQL and can be tested first.

## 3. Registration and password reset

Once a compatible MySQL service is running:

```bash
npm start
```

In a second terminal:

```bash
npm run web
```

Open http://localhost:5173, register a **new** user with a real email
address, and check your Inbox. Circle sends:

- A six-digit email confirmation code.
- A one-time verification link (`/#/verify/...`).
- Both expire after 20 minutes.

Only a verified account can log in. Use the six-digit code on the registration
screen, or follow the email link and then log in.

If sending fails, the registration screen explicitly warns that the email was
not sent. The account is still pending in MySQL. Use **Resend code** (after the
one-minute cooldown); do **not** register the same account again.

`Forgot password?` sends an email with a one-time reset link (30-minute
expiry). Public password-reset replies stay generic, so someone cannot discover
whether an email is registered.

## 4. Demo vs actual sending

`npm run web:demo` is an offline UI demonstration: it does **not** send real
mail, connect to MySQL or verify email addresses. Use `npm run web` for live
registration, and keep `ALLOW_DEV_VERIFICATION_TOKENS=false`.

## 5. Automated delivery checks

On the `circle-real-email` branch, CI starts a loopback SMTP server that
requires credentials, sends a real SMTP test message, then checks the actual
SMTP content for registration, resend, and password-reset messages. This
proves the server handed mail to an SMTP server, without storing or using
any real mailbox password. Confirming **external** delivery requires step 2
with your own sender credentials and inbox.
