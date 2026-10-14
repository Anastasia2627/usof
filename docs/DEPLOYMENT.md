# Public preview deployment (Railway + MySQL)

Usof's Vite frontend and Express API can now run on **one HTTPS address**.
The backend still uses the assignment-required **MySQL** database. No PostgreSQL conversion is needed.

## Railway setup

1. Connect this repository to a Railway project and create one application service with a public domain.
2. Add a Railway MySQL service to the project. Connect its variables to the app, using either the compatible Railway-provided `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` variables, or the existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` variables. Never put database passwords in Git.
3. Add app secrets: `AUTH_SECRET` (a long, random value) and `SEED_PASSWORD` (a separate strong password for initial development accounts). Production initialization explicitly rejects a missing `SEED_PASSWORD` on a fresh database, so the published site's administrator does **not** use the documented local-development password.
4. Deploy the repo as a Docker service using the root Dockerfile. It installs Node dependencies, builds `web/dist`, then runs `npm run start:hosted`: non-destructive `db:init` followed by the Express server. Railway supplies `PORT`; Node also accepts `APP_PORT` for local use.
5. Set `CLIENT_ORIGIN` to the public HTTPS URL for email links. Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, and `MAIL_FROM` to support production signup confirmation and password reset. Without SMTP, newly registered users cannot verify their emails in production.
6. Verify `https://<public-domain>/api/health`, then visit the domain root for the React client and test guest/user/admin flows. Set up restricted access or avoid real personal data while reviewing.

Production React uses the same-origin `/api` automatically unless `VITE_API_ORIGIN` is deliberately overridden at build time. Local `npm run web` still uses `http://localhost:5000`.

## Persistence, security and cost considerations

- Railway costs and limits depend on the chosen plan. Confirm its displayed pricing before provisioning resources.
- This is a **public review environment**, not hardened production infrastructure. The app creates demonstrative accounts and sample posts; use a private staging environment or access restrictions for sensitive data.
- `API/uploads/avatars` is local filesystem storage as required by the original challenge. Container filesystems may reset on redeploy: configure a persistent volume covering that directory before relying on uploaded avatars.
- Never use `db:reset` against a database containing important data. `db:init` is intentionally non-destructive.
- Protect `AUTH_SECRET` and `SEED_PASSWORD` in the hosting environment. Do not paste either into chat, commit to GitHub, or share demo admin credentials publicly.
- `SEED_PASSWORD` only affects new seeded databases; changing it does not update existing user passwords.

## Local production-mode smoke test

With MySQL initialized and a production React build present, launch `NODE_ENV=production PORT=5001 npm start`. Both `http://localhost:5001/` and `http://localhost:5001/api/health` should respond, and React should use the API on that origin.
