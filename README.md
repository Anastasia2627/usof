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

The frontend loads `web/src/basic.css` plus `web/src/threads.css`: a responsive, monochrome Threads-inspired style with a centered conversation column and bottom mobile navigation. There are no decorative animations. Optional Creative pages are not included in the Basic UI; this branch keeps the existing backend extensions so database migrations are not needed.

## Run locally on macOS (Docker Desktop)

**Docker Desktop must show "Engine running."** No need to click anything in the
empty Containers page; run these commands from your existing `usof` folder
in VS Code. If `git status --short` shows local edits, back them up before
switching branches.

```bash
git fetch origin
git switch --track origin/circle-full-requirements
npm install
```

If that branch already exists locally, use `git switch circle-threads-feed`
followed by `git pull --ff-only`.

In your **existing local** `.env`, set:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=usof
DB_USER=circle
DB_PASSWORD=YOUR_OWN_LOCAL_PASSWORD
CIRCLE_MYSQL_ROOT_PASSWORD=ANOTHER_LOCAL_ROOT_PASSWORD
AUTH_SECRET=YOUR_OWN_LONG_RANDOM_SECRET
```

Replace every `YOUR_OWN_...` placeholder with a secret you choose. Generate
secrets locally using `openssl rand -hex 24` and never paste them in chat.
The Docker Compose file uses the values of **your local .env** and does not
contain committed DB passwords.

```bash
npm run db:local:up
npm run db:init
npm start
```

Open another VS Code terminal in the **same** project folder:

```bash
npm run web
```

Visit `http://localhost:5173`. The API is at
`http://localhost:5000/api/health`. Test users and seeded content are stored
in a **real, persistent MySQL 8.4 Docker volume**, not in React state.
This volume is completely separate from the old Homebrew
`/opt/homebrew/var/mysql` data directory, so it neither upgrades nor
overwrites your old server. Don't run `db:reset` on a database containing work.

To stop the container **without deleting its data**:

```bash
npm run db:local:stop
```

**Important:** On the very first startup, Docker initializes the user and
password from `.env`. Changing them later does not automatically update an
existing initialized volume. If you need to rotate credentials, do so within
MySQL; do not delete the volume.

The browser-only `npm run web:demo` preview is optional, and not suitable
for defense because it does not store shared records or send email.

## Fixing the guest feed network warning

Public posts do **not** require login. If the guest home shows a network error
even when Docker is healthy and `npm start` says the API is listening, use
the **Threads UI branch** and restart the Vite process to pick up its new
same-origin proxy config. The browser now fetches `/api/...` from port 5173,
and Vite forwards the requests to `127.0.0.1:5000`.

In **one** terminal run `npm start`. In the **other** terminate the previous
Vite process with Ctrl+C, then run `npm run web`. Check both:

```bash
curl http://localhost:5000/api/health
curl http://localhost:5173/api/health
```

Both should return `{"status":"ok"}` while the real DB is connected.
If they do, reload the browser with Cmd+Shift+R. Do not switch to
`web:demo` and do not reset the MySQL database to hide the warning.

This branch also exposes a **Try again** action when a genuine API request
fails; browser requests work while logged out as well as logged in.

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

The full-requirements branch CI runs backend security tests, all mandatory and Creative API smoke tests (the backend remains compatible), MySQL email verification checks, a React build and Chromium checks covering a 390px mobile viewport, admin pagination and real registration. Check the latest run on the [Actions page](https://github.com/Anastasia2627/usof/actions) for UI evidence. Older screenshots under `docs/screenshots` show the preceding interface, not the simplified Basic theme.

## Documentation

- [API reference](docs/API.md)
- [Backend requirement mapping](docs/BACKEND_COMPLIANCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [CBL learning process](docs/CBL.md)
- [Functional testing](docs/ASSESSMENT.md)
- [Defense checklist and safe Mac setup](docs/DEFENSE_20_STEPS.md)

### Development test accounts

After initialization, sample logins include `admin`, `asya`, `alex`, `maria` and `sam`, with password `Password123!`. These accounts are only for local development, not production.

The `Share` reflection and publication requested by the assignment is a separate student submission step.
