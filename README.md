# Circle — USOF Backend + Frontend

Circle is a small question-and-answer discussion application built for the **Usof backend** and **Usof frontend** Basic assignments. It uses Node.js, Express, MySQL, React, Redux, HTML and CSS. No third-party UI framework is used.

## October 2026 email verification and account protection

- Registration and admin-created accounts now require a 6-digit confirmation code or verification link, delivered in a branded responsive Circle HTML email with a plain-text fallback
- Verification codes expire after 20 minutes and are limited to five failed attempts per issued code; sign-in, registration, resend and reset routes also have single-process IP rate limits
- Configure `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` and `MAIL_FROM` in your **local** `.env` for real SMTP delivery — never commit credentials
- An existing password account will **not** be automatically linked to Google solely because the two emails match; secure explicit linking is a separate future flow
- In production, `AUTH_SECRET` must be a long, unique random value — example and weak values are rejected before startup
- When creating a brand-new production database, supply private `BOOTSTRAP_ADMIN_LOGIN`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` (12–72 UTF-8 bytes); demo fixture accounts with known passwords are never created in production
- After updating an existing MySQL database run `npm run db:init` to add `verification_attempts` and other additive fields, without deleting saved posts
- Run backend checks with `npm run check:backend` and integration tests with `npm run test:auth`, `npm run test:email:integration` and `npm run test:smoke` against a **disposable test database**
- Protected media for unpublished posts now uses short-lived signed URLs and per-request database authorization. Remaining production-hardening work includes distributed request rate limiting, durable email-delivery retry/outbox, dependency updates with a committed lockfile, and secure Google account linking — do not treat this review branch as production certified

## Required features

- Registration with email verification (code or link), login, logout and password reset
- Three roles: `user`, `moderator` and `admin`, with API-enforced access permissions
- User profile, avatar upload, profile editing, account rating and personal posts
- Posts: create, read, edit own content, delete, multiple categories, active/inactive status and locking
- Comments and nested replies; comment status moderation, deletion and locking
- One like/dislike per user per post or comment; list and remove reactions
- Home feed: posts sorted by positive likes by default, date asc/desc, category/date/status filters, pagination and real search across posts, people and categories
- Admin console to manage users, posts, categories, comments and reactions
- Responsive header containing site name, search, menu, avatar, login and role; logout remains accessible on mobile
- Informative form errors, backend MVC/service/model structure, OOP, relational MySQL data and local avatar storage

The frontend combines the Circle editorial styling with light/dark settings, animated login and registration photography, interest-based feed ranking and a custom account-status page. This branch includes database migrations for new account verification and moderation fields, so run `npm run db:init` after pulling changes

## Run locally on macOS (Docker Desktop)

**Docker Desktop must show "Engine running."** No need to click anything in the
empty Containers page; run these commands from your existing `usof` folder
in VS Code. If `git status --short` shows local edits, back them up before
switching branches.

```bash
git fetch origin
git switch design/clean-auth-account-status-2026-10-20
npm install
```

If that branch already exists locally, use `git switch design/clean-auth-account-status-2026-10-20`
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
`http://127.0.0.1:5050/api/health`. Test users and seeded content are stored
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

## Public home and assessment compliance

The homepage `/#/` shows a public feed sorted by positive likes (descending) for both guests and signed-in members, with visible search, menu, category filters, date ascending/descending and pagination. Guests can read posts; writing, replying, voting and reporting require authentication. The original welcome design remains at `/#/welcome`.

## Refined interface and moderator assignment

The login and sign-up screens use a photo-arc editorial layout on desktop
and a compact stacked layout on mobile. The post composer keeps the original title,
body, category selection, preview, photos, and publication options, now arranged in
smaller visual sections. Every category remains selectable within a compact,
scrollable list, including categories added after initialization.

**Give a user moderator rights:** sign in as an admin, open **Admin → Users**,
find the user's row and click **Make moderator**. Confirm the action; the
user's role changes to `moderator` instantly in the admin list and in their existing session.
A persistent notification is created and the open site displays a role-change banner. **Remove moderator** restores
the standard `user` role. Only administrators can appoint or revoke moderators.
The older Edit → Role selector is also available.

Private direct messages have been retired. There is no Messages button, profile
message action, messages page or messaging API. An existing `direct_messages`
table (if present) is left intact for data safety, but fresh databases do not
create it and the application never accesses it.

## Server-side moderator permissions

Role changes happen through the administrator-only `PATCH /api/users/:id`
with `{"role":"moderator"}` or `{"role":"user"}`. The server reloads
roles from MySQL on every authenticated request (rather than trusting a JWT
role), so new permissions and revocations take effect even in open sessions.
A notification records each actual role change. Only admins can create users,
change another account's identity/role, manage categories or see the admin dashboard.
The last remaining administrator cannot be demoted or deleted.

**Moderators may:** review/dismiss reports; deactivate/reactivate, lock/unlock
or delete community posts; moderate comments and reactions; edit their own
post title/body, photos and categories. Ordinary users keep the status-only
comment workflow required by the coursework.

**Moderators may not:** grant roles or edit accounts; change another author's
post text, categories or hidden-like setting; moderate administrator posts,
administrator replies, or delete administrator reactions (including bulk
clearing of votes); view other people's unpublished scheduled posts through
the feed, search, a direct post URL or the moderation queues. Posts that are
inactive *after publishing* remain available for moderation.

The API enforces these restrictions, not just the React buttons. Relevant
checks live in `API/src/services/moderationPolicy.js`, and the dedicated
MySQL integration suite is `npm run test:moderator`. As with all integration
tests in this project, use `NODE_ENV=test` and a disposable database ending
in `_ci` or `_test`. The Circle GitHub Actions workflow runs this suite
on updates to the active review branch.

## UX improvements

Circle uses one understated rounded design language for the feed, discussion
pages, editors, member profiles, saved posts, settings, notifications and admin
controls. Small repeated actions (save, share, votes, delete notification) are
icon-only with accessible labels; important tasks keep text next to their icon.

- **Share** any post directly from its feed card or detail page using the share
  icon; the copied URL opens the same post.
- **Text draft recovery:** while writing a new post, text, selected categories
  and publication settings are saved in the current browser tab. They survive
  a refresh and can be discarded. **Images are not persisted** and must be
  reselected after a reload. After successfully publishing, the draft clears.
- **Empty feed recovery:** if filters return no posts, clear them in one click.
- **Notifications:** compact single-icon delete action and labelled mark-all-read.

These are optional usability features beyond the Basic PDF; they require no
database changes. The underlying permissions and sorting/filtering rules remain
covered by the course requirements and automated review tests.

Design/flow audit: [docs/UX_AUDIT_OCT2026.md](docs/UX_AUDIT_OCT2026.md).

## New community features

- **Post photos:** authors upload up to four JPEG/PNG/WebP photos (5 MB each); images are decoded and normalized to WebP, stored under `API/uploads/posts`, shown in cards and a full-screen gallery, and removable by the author.
- **Best answer:** a post author can mark/unmark one active reply as accepted, so the post displays `Solved` and the selected reply displays `Best answer`.
- **Reporting:** signed-in users may report someone else's post or comment for spam, abuse, off-topic content or other reasons; duplicates are rejected. Reports are handled in the Admin → Reports queue.
- **Formatting:** posts support headings, bold text and ordered/unordered lists. The composer offers toolbar buttons and a live safe preview; text is rendered as React nodes without injecting user-supplied HTML.
- **Moderators:** administrators can grant/revoke `moderator` in Admin → Members → Edit → Role. Moderators can review reports, lock, deactivate or delete posts and comments, and moderate reactions; they cannot create users, change roles, manage categories or edit other authors' post text/categories. The server checks every permission.

On an existing database, run `npm run db:init` to apply additive schema upgrades without erasing users/posts. Use `npm run db:reset` only on a disposable database.

Integration test in CI: `npm run test:features` (requires `NODE_ENV=test` and a disposable `*_ci` or `*_test` database). Tests include real image upload and readback, owner-only deletion, accepted answers, reports and moderator permissions.

## Fixing the guest feed network warning (macOS AirPlay port collision)

**On macOS the `AirPlay Receiver` / `AirTunes` service can claim port
5000 and reply with `HTTP 403` (header `Server: AirTunes`). This is not
a login error, and restarting MySQL will not fix it.** In your existing
uncommitted root `.env`, change these two lines while preserving the DB/SMTP
credentials:

```dotenv
APP_PORT=5050
VITE_API_ORIGIN=http://127.0.0.1:5050
```

Vite dynamically reads `APP_PORT` from the SAME `.env` and proxies API
requests there. Both Node and Vite must be restarted once after changing a
server port, but future React/CSS updates are automatic. **Do not** create a
new Docker volume, reinitialize the database, switch branches, or turn off
AirPlay globally.

Public posts do **not** require login. If the guest home shows a network error
even when Docker is healthy and `npm start` says the API is listening, use
the **Threads UI branch** and restart the Vite process to pick up its new
same-origin proxy config. The browser now fetches `/api/...` from port 5173,
and Vite forwards the requests to `127.0.0.1:5050`.

In **one** terminal run `npm start`. In the **other** terminate the previous
Vite process with Ctrl+C, then run `npm run web`. Check both:

```bash
curl http://127.0.0.1:5050/api/health
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

The circle-threads-feed branch CI runs backend security tests, all mandatory and Creative API smoke tests (the backend remains compatible), MySQL email verification checks, a React build and Chromium checks covering a 390px mobile viewport, admin pagination and real registration. Check the latest run on the [Actions page](https://github.com/Anastasia2627/usof/actions) for UI evidence. Older images under `docs/screenshots` are historical. For current screenshots of the public home, post/profile, editor and mobile UI, open the latest successful Circle workflow run in GitHub Actions and download its `circle-basic-screenshots` artifact.

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
