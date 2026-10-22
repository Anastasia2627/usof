# Circle · Peer assessment checklist (18 questions)

This guide maps the current **Usof backend Basic** checklist to code locations and
a reproducible HTTP/MySQL test. A code review is **not** evidence that a running
server or database passes the test. Do not mark runtime items “Yes” without
performing the commands against the submitted version.

| # | Assessment item | Current implementation / evidence | Verification |
|---|---|---|---|
| 1 | JS / Node.js / SQL style guides and best practices | Layered modules, parameterized SQL, explicit validators, centralized errors; style consistency requires reviewer inspection | Run syntax/build + inspect code |
| 2 | Files and directory layout | `API/`, `web/`, `scripts/`, `tests/`, `docs/`; no generated dependencies or secrets in Git | Inspect repository tree |
| 3 | Academic integrity | Technical tests cannot determine intent, authorship or understanding | Explain and justify the implementation and follow campus rules |
| 4 | MVC | Routes → controllers → services/entity models → MySQL | `API/src/routes`, `controllers`, `models` |
| 5 | OOP | `BaseModel` inherited by `User`, `Post`, `Category`, `Comment`, `Reaction`, etc. | Inspect inheritance |
| 6 | Reachable application | Health endpoint tests an actual DB connection | `GET /api/health` |
| 7 | Express | `API/app.js`, `API/server.js` | Start server and test endpoint |
| 8 | MySQL | `mysql2` pool, schema and foreign keys | Query MySQL server |
| 9 | Five rows per table | Fresh **test** fixture seeds all 16 current tables, including historical category proposals and appeals | `npm run test:requirements` |
| 10 | Registration and user creation | Public `POST /api/auth/register`; admin `POST /api/users` | Complete email verification and inspect DB |
| 11 | Password change | Own `PATCH /api/users/:id` with `oldPassword`, `newPassword`; admin can reset a user's password; previous JWT and password are invalidated | `tests/coursework-core-requirements.test.mjs` |
| 12 | Admin CRUD | Users, posts, categories, comments, reactions with role-based permissions; admins **cannot edit text** of posts/comments per the backend PDF | `docs/BACKEND_COMPLIANCE.md` and HTTP verification |
| 13 | Post information and multiple categories | `POST /api/posts` with an array of category IDs, post details/list | `npm run test:requirements` |
| 14 | Only one like/dislike per post | Unique composite indexes on reactions; a second vote updates the first | HTTP and SQL tests |
| 15 | Own post editing + inactive status | Owner may edit content/categories and deactivate their post; only admins may reactivate deactivated posts | New ownership tests |
| 16 | Automatic ratings | Post/comment vote counts and user reputation account for likes (+1) and dislikes (-1) | `tests/rating-concurrency.test.mjs` |
| 17 | Category CRUD | Public list/details/category posts, admin create/patch/delete | HTTP requirements script |
| 18 | Comments CRUD and visibility | Post comments, details, create, status, delete, likes/dislikes; inactive entries remain in list while non-author content is masked for privacy | HTTP requirements script |

## How to validate without touching real users

Use a **disposable** database named `usof_ci` or `usof_test`. In a test environment
set `NODE_ENV=test`, `DB_NAME=usof_ci`, a MySQL connection, and a
non-production `AUTH_SECRET`. The repository's GitHub Actions workflows
provide MySQL and the environment automatically.

```bash
npm install
npm run check:backend
npm run db:reset
npm run test:auth
npm start
```

In a second terminal against the **same test server**:

```bash
npm run test:requirements
npm run test:smoke
```

`db:reset` is destructive. **Never use it on the main `usof` database**.

## Short HTTP examples

The canonical paths are from the original task PDF. It explicitly allows
alternative URL organization. The examples below use the Circle API mounted
under `/api/auth`, `/api/users`, `/api/posts`, and `/api/categories`.

```bash
API=http://127.0.0.1:5050/api

curl -i "$API/health"
curl -i "$API/categories"
curl -i "$API/posts?sort=likes&order=desc"
curl -i "$API/posts/1/comments"

curl -i -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"login":"sample_peer_user","email":"sample_peer_user@example.com","password":"ReplaceWithYourTestPassword","passwordConfirmation":"ReplaceWithYourTestPassword"}'

# Supply a bearer token obtained through POST /api/auth/login:
# PATCH /api/users/:id with oldPassword and newPassword
# PATCH /api/posts/:post_id with {"status":"inactive"} as the owner
# POST /api/posts/:post_id/like with {"type":"like"} / {"type":"dislike"}
# PATCH /api/comments/:comment_id with {"status":"inactive"}
```

Requests may also use `application/x-www-form-urlencoded` for simple scalar
fields. Multiple post categories should be sent in JSON arrays.

## Grading cautions

- Verify the **actual running server** and the row counts of the submitted DB
- An already-existing DB is never silently reset or filled with fake data:
  seed guarantees refer to fresh disposable test initialization
- The PDF requires password confirmation during registration; the shortened
  assessor `curl -d` example is not the complete request body
- Deliberate masking of inactive comment text is an additional moderation
  choice; inactive comments and their statuses still appear in the list
- Academic integrity cannot be established from a repository scan or tests
