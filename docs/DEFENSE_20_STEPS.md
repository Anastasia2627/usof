# Circle — Innovation Campus defense checklist

This guide follows the 20 actions in the supplied Ukrainian presentation
checklist. Use **real** server mode (`npm start` + `npm run web`); **do not**
defend using `web:demo`, because it uses browser-only sample data.

The reviewer examples are illustrative; the app is named Circle.

| # | Reviewer action | Where / what to show |
|---|---|---|
| 1 | Open home with posts sorted by number of likes | Home `/#/`; highest likes appear first by default |
| 2 | Sort by creation date ascending/descending | Home: Sort by `Publication date`, Direction `Ascending` / `Descending`, Apply |
| 3 | Filter by category | Home: Category, Apply; only that topic's posts remain |
| 4 | Open registration form | Sign up `/#/register` |
| 5 | Register a new unique login | Register using a **real email**; confirm SMTP code or link to activate account |
| 6 | Log in as first user | Verify header shows their login, role `user`, avatar |
| 7 | Show header/menu at different widths | Site name, search, Home, Categories, avatar, login, role, Log out, New post |
| 8 | Click avatar | Opens `/#/profile` |
| 9 | Change own profile | Edit username or full name and save. **Username changes log you out** to invalidate old session; re-login with the new name. Refresh and confirm the update persisted. |
| 10 | Create two categorized posts | New post `/#/create`, title, body, check category, Publish |
| 11 | Change own post category and content | Open Edit for a post `/#/edit/:id`; save and refresh `/#/post/:id` |
| 12 | Display post previews | Home shows author, publication date, title, excerpt, categories, like and comment counts |
| 13 | Resize browser/mobile | Try 390, 768 and 1280 px; menu, profile and logout remain visible |
| 14 | Log in as admin in another browser | Open **Incognito** or another browser; seeded admin credentials in README |
| 15 | Show two-user discussion | User adds comment; admin replies; user replies to admin; both can like/dislike, change/remove their reaction; changing comment status is the `PATCH` update supported by the original Backend Basic specification |
| 16 | Admin updates first user's data | Admin console `/#/admin` → Users; update full name or login; refresh first user's profile |
| 17 | Edit content inside first user's post | Switch back to **first user's session** and edit the post. Under original backend requirements, admins may change **categories/status/locked**, but **cannot** change somebody else's title or body. |
| 18 | Add a new category | Admin console → Categories → Create. Verify the checkbox appears in New/Edit post form |
| 19 | Delete other user's comment | In admin session, open post or Admin console → Comments → Delete |
| 20 | Log out | Header → Log out. Reload; user-specific controls disappear |

## Demo preparation

- Have **two independent browsers** open (normal and Incognito): one user and admin.
- In a fresh DB, run `npm run db:init` only once; do not run `db:reset` on a DB containing useful data.
- Prepare two different post titles, 2 categories, and a short question/reply.
- For registration, configure SMTP before the review and register a user with
  an inbox you can open. A real code should arrive by mail.
- For user login updates, remember the updated username and same password.
- If you intend to edit a comment, **the Basic PDF permits changing its
  active/inactive status**, not editing comment text. Moderators also cannot
  edit post/comment content according to the PDF.
- On all screenshots and reviewer clicks, show **real MySQL-backed data**.

## CI

Run `npm run test:defense` only with `NODE_ENV=test` and a disposable
`DB_NAME` ending in `_ci` or `_test`. It uses two independent Chromium
contexts. GitHub Actions sets this up automatically along with registration
SMTP verification, MySQL and the existing authorization tests.

## Mac MySQL (data-preserving recommendation)

Your previous error `Cannot upgrade from 90600 to 260700` is a MySQL version
mismatch, **not a Mac defect**.

- **Normal Homebrew path for your existing 9.6 data:** 9.6 → **9.7 LTS**
  → 26.7 (upgrade to 26.7 only if needed). `brew install mysql@9.7`
  is available on Apple Silicon. Back up the entire stopped directory first
  and use the 9.7 service/binary against the old directory only after verifying
  the backup, service status and version. The existing root password is still
  required or must be safely recovered under 9.7.
- **Simple isolated solution for the defense:** install Docker Desktop, run
  `npm run db:local:up` from this project. It creates a separate MySQL 8.4
  database bound only to `127.0.0.1:3307`. This DOES NOT use the old MySQL
  files. It is a real database with persistent Docker volume.
- Set the Circle server's local `.env` to:
```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=usof
DB_USER=circle
DB_PASSWORD=circle_local_dev_only
```
- Then, **only against this fresh container**:
```bash
npm run db:init
npm start
# Separate terminal:
npm run web
```
- Stop the Docker service via `npm run db:local:stop`. The data persists
  without `down -v`.
- Never delete `/opt/homebrew/var/mysql` or run a new server against
  its original 9.6 data directory without verifying version support and backup.
  For preservation of old records, upgrade/dump/restore separately.

The compose credentials are for local loopback development only. Never
deploy the file publicly or re-use them on production.
