# Circle Demo Mode

The demo runs **locally** with simulated accounts and data. It is intended for UI/UX testing while MySQL, email and OAuth are not configured. The real API and original authentication paths are unchanged.

## Start

In the project root:

```bash
npm install
npm run web:demo
```

Open `http://localhost:5173/#/register`. Stop an existing `npm run web` process first, otherwise Vite may choose another port.

## Try it

- Sign up using a made-up email address, a unique username, and any **test-only** password of at least eight characters. Repeat the same password for confirmation. The app creates a fake browser account and opens Circle Space immediately; **no emails are sent**.
- Sign out and sign back in with the same username or dummy email and any non-empty test password. Passwords are neither validated nor stored in demo mode.
- From the login page choose **Try member account** or **Try admin account** to enter directly without completing a form.
- Publish test posts and visit your profile. Demo accounts and posts use browser localStorage for convenience, not MySQL. Other interactions may use mock responses and do not have full persistence.
- A visible **DEMO MODE** banner and dashboard preview labels clarify that these are simulated interactions and sample metrics.

## Return to the real backend

Stop demo Vite (Ctrl+C) and run `npm run web` instead. The default command preserves real API registration and email verification logic; it requires a running backend and configured MySQL. Demo sessions use a **different** browser storage key from real login sessions.

## Limitations

Do not use real passwords, email addresses, or private information in demo mode. The mock account system does not provide real authentication; it accepts any non-empty password. Test-only accounts and posts are stored in the current browser, can be cleared by browser storage cleanup, and are not shared with other users. Uploads, transactional mail, production permission enforcement and database integration must be validated separately with the real backend.

This mode is only enabled via the Vite development mode `demo` and is not part of a standard production build.
