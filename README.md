# Circle — USOF Basic

Circle is a small question-and-answer discussion application built for the **Usof backend** and **Usof frontend** Basic assignments. It uses Node.js, Express, MySQL, React, Redux, HTML and CSS. No third-party UI framework is used.

## Required features

- Registration with email verification (code or link), login, logout and password reset
- Two roles: `user` and `admin`, with API-enforced access permissions
- User profile, avatar upload, profile editing, account rating and personal posts
- Posts: create, read, edit own content, delete, multiple categories, active/inactive status and locking
- Comments and nested replies; comment status moderation, deletion and locking
- One like/dislike per user per post or comment; list and remove reactions
- Home feed: posts sorted by positive likes by default, date asc/desc, category/date/status filters, pagination and real search across posts, people and categories
- Admin console to manage users, posts, categories, comments and reactions
- Responsive header containing site name, search, menu, avatar, login and role; logout remains accessible on mobile
- Informative form errors, backend MVC/service/model structure, OOP, relational MySQL data and local avatar storage

The `web/src/basic.css` file is the only stylesheet loaded. It deliberately uses plain system fonts, one accent color and **no animations or decorative effects**. Optional Creative pages are not included in the Basic UI; this branch keeps the existing backend extensions so database migrations are not needed.

## Run locally

Requirements: Node.js 20+, npm and a compatible running MySQL server (see your server version before upgrading existing data).

```bash
git clone https://github.com/Anastasia2627/usof.git
cd usof
git switch circle-basic-minimal
npm install
cp .env.example .env
```

Configure the existing `.env` with MySQL host, database, username, password and `AUTH_SECRET`. Never commit passwords.

For a **new/empty** database, seed the required test data:

```bash
npm run db:init
```

This initialization does not delete a complete existing schema. Do **not** use `db:reset` to troubleshoot connection errors: it would delete existing project data.

Start the API and React in separate terminals:

```bash
npm start
```

```bash
npm run web
```

Open `http://localhost:5173`. Verify the live database connection at `http://localhost:5000/api/health`.

A standalone UI preview with fake, browser-local data is available using `npm run web:demo`. It is **not** a replacement for API/MySQL tests and does not provide real shared accounts or email delivery.

## Real email — test it before fixing MySQL

Circle sends registration codes, one-time verification links, and password-reset links
via authenticated SMTP. Gmail instructions are in
[Real email setup](docs/REAL_EMAIL_VERIFICATION.md).

Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` and `MAIL_FROM`
in your uncommitted server-side `.env` (Gmail typically uses `smtp.gmail.com`,
port `465` and a Google app password, **not** your regular Google password).

To verify delivery to a real mailbox **without needing MySQL**, run:

```bash
npm run mail:check
npm run mail:send-test -- your-inbox@gmail.com
```

The first command verifies SMTP authentication; the second sends a real message.
Check Inbox/Spam after the provider accepts it. `npm run web:demo` deliberately
does not send any mail.

## Email confirmation

For real registration and password reset emails, set `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` and `MAIL_FROM` in your uncommitted `.env`, then run `npm run mail:check`. Without working SMTP, new accounts remain unverified and cannot log in to the real app. See [email instructions](docs/REAL_EMAIL_VERIFICATION.md).

## Screenshots and verification

The Basic branch CI runs backend security tests, all mandatory and Creative API smoke tests (the backend remains compatible), MySQL email verification checks, a React build and Chromium checks covering a 390px mobile viewport, admin pagination and real registration. Check the latest run on the [Actions page](https://github.com/Anastasia2627/usof/actions) for UI evidence. Older screenshots under `docs/screenshots` show the preceding interface, not the simplified Basic theme.

## Documentation

- [API reference](docs/API.md)
- [Backend requirement mapping](docs/BACKEND_COMPLIANCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [CBL learning process](docs/CBL.md)
- [Functional testing](docs/ASSESSMENT.md)

### Development test accounts

After initialization, sample logins include `admin`, `asya`, `alex`, `maria` and `sam`, with password `Password123!`. These accounts are only for local development, not production.

The `Share` reflection and publication requested by the assignment is a separate student submission step.
