# Circle email verification — real server setup

Circle uses the **existing** Node.js / Nodemailer + MySQL flow. It is not a mock when started with `npm start` and `npm run web`.

## Configure sending

Edit your local `.env` (not `.env.example`, and do not commit it). For example, for an SMTP provider supporting STARTTLS:

```dotenv
MAIL_HOST=smtp.your-provider.example
MAIL_PORT=587
MAIL_USER=sender@example.com
MAIL_PASSWORD=your-smtp-app-password
MAIL_FROM=sender@example.com
CLIENT_ORIGIN=http://localhost:5173
VITE_API_ORIGIN=http://localhost:5000
ALLOW_DEV_VERIFICATION_TOKENS=false
```

For Gmail personal accounts, the server host is `smtp.gmail.com` and port `587` (STARTTLS) or `465` (TLS). Use a supported OAuth2 method or an **app password**, if available for your account; don't use your normal Google password. Some Google Workspace accounts require different administrator configuration.

`CLIENT_ORIGIN` MUST match the frontend's public URL when deployed (e.g. `https://circle.example.com`), otherwise users receive confirmation links pointing at localhost. Set CORS accordingly through the same origin. Keep the SMTP password and `AUTH_SECRET` in deployment secrets, never in git.

## Test connection and complete delivery

1. Start MySQL and initialize the existing Usof schema with `npm run db:init`. Do **not** reset an existing database just to configure mail.
2. Run `npm run mail:check`. It tests SMTP connectivity and authentication **without sending email**.
3. Start the API: `npm start`.
4. Start frontend: `npm run web` (not `npm run web:demo`).
5. Register using an email inbox you control. The backend creates a pending user, hashes their password, generates a one-time link + six-digit code and sends the message via SMTP.
6. Follow the link or enter the code within 20 minutes. This marks the account verified in MySQL. The code path then attempts to log in automatically and open the **actual main feed**; the email link path presents the Login button because it may open on another device/browser.
7. If the message didn't send, the form displays the failure and has **Resend verification email**. The endpoint implements a one-minute in-process cooldown. On a public multi-server deployment, add shared rate limits and anti-abuse protection.

The sender may accept a message while it is later filtered as spam; confirmation with a real mailbox is needed before claiming successful end-to-end email delivery.

## Demo vs real

`npm run web:demo` uses the **same page styling** but emulates account creation and posts in the browser. It does not send email, connect to MySQL, or validate passwords. The mode is a UI prototype, not a way to test server security.

`npm run web` connects to the API. If the API cannot be reached, the older client still has a development mock fallback; for reliable real integration checks, verify API `http://localhost:5000/api/health` first, and use the live backend with the environment configured.
