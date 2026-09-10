# Backend PDF compliance audit

This document maps the mandatory **Usof backend — Track Full Stack (August 31, 2026)** requirements to the implementation. Each Basic requirement is tied to code or an automated verification path, while additional hardening is documented separately rather than presented as a PDF requirement.

## Act: Basic — platform and architecture

| PDF requirement | Implementation / proof |
| --- | --- |
| Allowed stack: JS, Node.js, Express, MySQL | Root `package.json`, `API/`, Express application and MySQL driver. |
| Develop API server and relational MySQL database | `API/app.js`, `API/server.js`, `API/src/config/db.js`. |
| Admin panel available only to admins | React `/admin` console plus backend `requireAdmin` protection on admin API operations. The UI is not the security boundary. |
| Database created/recreated on initialization | `npm run db:init` creates/seeds a fresh schema safely. Intentional recreation is provided by `npm run db:reset -- --confirm=<DB_NAME>`; CI uses that explicit reset only on disposable `usof_ci`. |
| User photos stored on local server filesystem | `API/uploads/avatars/`; database stores only the relative path. Uploaded content is decoded and normalized before storage. |
| At least five test rows in every table | Seed creates at least five rows per challenge table. `scripts/verify-backend-requirements.mjs` checks the core tables automatically. |
| Informative error handling | Central `errorHandler`, stable JSON error codes/messages, validation/upload/database errors, malformed JSON handling and 404 handler. |
| MVC | Routes → thin controllers → services/models → MySQL, documented in `docs/ARCHITECTURE.md`. |
| OOP | Entity classes `User`, `Post`, `Category`, `Comment`, `Reaction` inherit from `BaseModel`; `AppError` is reusable. |
| SOLID-oriented design | Authentication, accounts, avatars, posts, comments, categories, reactions/rating, notifications and dashboards are split into focused services. Controllers remain HTTP-facing and shared validation lives in one utility module. |
| Validate requests and role access | IDs, body values, statuses, dates, categories, roles, decoded files, ownership and admin-only operations are checked server-side. |

`db:init` no longer achieves recreation by silently dropping tables. This is intentional hardening: a normal initialization leaves an existing complete schema untouched and refuses a partial schema. The explicit `db:reset` command remains the reproducible recreation path required for development and assessment.

## Admin functionality

| PDF requirement | Implementation |
| --- | --- |
| Log in | `POST /api/auth/login`. |
| Log out | `POST /api/auth/logout`; increments `token_version`, invalidating old bearer tokens. |
| Reset password | Request + confirm endpoints with expiring reset token; reset invalidates old sessions and atomically consumes the token. |
| Create user/admin | `POST /api/users`, admin-only. The required `role` parameter is explicitly required. |
| See all profiles | `GET /api/users`, admin-only. |
| Update profile data | `PATCH /api/users/:user_id`, admin can update login/email/full name/role. Email changes require re-verification and revoke stale credentials. |
| Delete users | `DELETE /api/users/:user_id`, admin can delete users while the application preserves at least one administrator. |
| Create posts | Authenticated `POST /api/posts`; admins are authenticated users and may create posts. |
| See all posts, including inactive | Admin visibility bypasses normal active/owner filtering. |
| Change post category/status | Admin `PATCH /api/posts/:post_id` supports categories and active/inactive status. |
| Admin cannot edit user post content | Admin attempts to change post title/content are rejected explicitly. |
| Delete posts | Admin may delete any post. |
| Category CRUD | Admin-only POST/PATCH/DELETE plus public GET routes. |
| Create comments | Admin may create comments/replies, including moderation scenarios normal users cannot. |
| See all comments | Admin list endpoint plus all comments under a viewable post. |
| Change comment status | Admin may set active/inactive. |
| Comment content is not editable | Content update is rejected for both admin and users. |
| Delete comments | Admin may delete any comment. |
| Create one like/dislike per target | Database unique indexes + transactional mutation; an admin reaction belongs to the same admin account. |
| See all likes | Admin may inspect reactions on active or inactive posts/comments. |
| Delete likes | Admin may delete own reaction or clear all reactions on a target with `?all=1`. |

## User functionality

| PDF requirement | Implementation |
| --- | --- |
| Everyone can register | Public `POST /api/auth/register`. New accounts always receive role `user`. |
| Confirm that email belongs to user | Expiring verification token/link; login is blocked until verified. |
| Log in / log out / reset password | Implemented in authentication service/controllers. |
| Create posts | `POST /api/posts` with title, content and at least one valid category. |
| See active posts + own inactive posts | Visibility is enforced in list/detail and reused by related engagement flows. |
| Update own post | Owner can update title/content/categories; cannot set moderation status/lock. |
| Delete own post | Owner/admin authorization check. |
| Create comments under active posts | Enforced server-side; locked discussions additionally reject normal-user comments. |
| See all comments for the specified viewable post | `/api/posts/:post_id/comments` returns all comment rows/statuses once the post itself is viewable. |
| “update any” comment — only active/inactive status | Implemented literally: any authenticated user can change status of any comment belonging to a post that user may access. Comment content cannot be edited. |
| Delete comments | A normal user may delete their own comment; admin may delete any. |
| One like/dislike per post or comment | Unique database constraints and transactional mutation semantics. |
| See likes under specified active post/comment | Non-admin reaction-list endpoints require an active target; admin may inspect inactive targets. |
| Delete self-created likes | DELETE reaction routes remove only the current user's reaction unless admin explicitly requests clear-all. |

## Required entity fields

### User

- `login` — unique database column.
- `password` — stored only as bcrypt `password_hash`.
- `full_name`.
- `email` — unique and verified before login.
- `avatar` — local file path.
- `rating` — stored and maintained from reactions received by posts/comments.
- `role` — `ENUM('user','admin')`, default `user`; normal users cannot change it.

### Post

- author: `author_id` foreign key.
- title.
- publish date: `created_at`.
- status: active/inactive.
- content.
- categories: many-to-many `post_categories`; several categories are supported.

Post images are described in the PDF as highly recommended rather than mandatory, so they are not treated as a Basic blocker.

### Category

- title.
- description.

### Comment

- author: `author_id`.
- publish date: `created_at`.
- content.

Additional fields `status`, `locked` and `parent_comment_id` implement required moderation/locking plus nested replies.

### Like / reaction

- author: `author_id`.
- publish date: `created_at`.
- exactly one target: `post_id` or `comment_id`.
- Basic type: `like` or `dislike`; Creative adds `useful`, `thanks` and `fire`.

The database check constraint guarantees exactly one target and unique indexes guarantee one reaction per user/target.

## Endpoint surface

The implementation provides the PDF endpoint structure plus documented additions:

- Authentication: register, email verification, login, logout, password reset request/confirm.
- Users: list, detail, admin create, avatar upload, update, delete.
- Posts: list/detail/comments/categories/reactions, create/update/delete, add/remove reaction.
- Categories: list/detail/posts, create/update/delete.
- Comments: detail/reactions, add/remove reaction, update status, delete; `/api/comments` is an additional admin listing endpoint.
- Creative: saved/followed libraries, share tracking, notifications and user/admin dashboards.

Exact methods/access/payloads are documented in `docs/API.md`.

## Sorting, filtering and pagination

`GET /api/posts` supports:

- pagination with `page` and `limit`;
- default sorting by number of positive likes, as the PDF states;
- sorting by date;
- ascending/descending order;
- filtering by category;
- filtering by date interval; a date-only upper bound includes that full day;
- filtering by active/inactive status;
- additional author and text-search filters;
- Creative `trending` sorting.

The dedicated requirement test creates posts whose positive-like order differs from their net score, so CI fails if `sort=likes` is accidentally implemented as net reputation.

## Locking

Posts and comments have `locked` fields. Normal users cannot add comments/replies/reactions to locked discussion targets and cannot edit a locked post/comment status. Admins may lock/unlock and continue moderation.

## Hardening beyond the Basic wording

These safeguards are not substituted for the PDF requirements; they protect the same features under failure/concurrency cases:

- **Safe database lifecycle:** `db:init` never destroys an existing schema. `db:reset` is separate and requires an exact database-name confirmation outside disposable `_test`/`_ci` environments.
- **Password-reset race protection:** final password change conditionally matches the same still-valid reset-token hash after bcrypt work, so only one concurrent use succeeds.
- **Email lifecycle:** changing email invalidates sessions, password-reset credentials and old verification credentials, then requires confirmation of the new address.
- **Avatar content validation:** multipart bytes are decoded with `sharp`, JPEG/PNG/WebP is determined from actual contents, and accepted files are normalized to WebP with dimension limits.
- **Last-admin invariant:** administrator rows are locked while admin deletion/demotion is checked, preventing the system from losing its final admin even under competing requests.
- **Concurrent reputation:** ordinary reaction changes use an atomic `rating = rating + delta` update instead of read-compute-write replacement; dedicated tests run reactions on different targets concurrently.
- **Service boundaries:** core controllers no longer own SQL transaction blocks and repeated validation/business rules. Auth, account, post, comment, category, avatar and rating behavior is in dedicated services with shared validators.

## Documentation requirement

The repository contains:

- README with description, screenshots, requirements/dependencies and safe clone-to-run instructions;
- `docs/CBL.md` with progress/reflection for Engage, Investigate and Act;
- `docs/ARCHITECTURE.md` with whole-program architecture/algorithm and main flows;
- `docs/API.md` with endpoint documentation;
- this requirement-by-requirement audit;
- real running-app screenshots in `docs/screenshots/`.

## Automated proof

`npm run test:requirements` performs PDF-specific checks against a running API/MySQL instance, including schema/seed invariants, required entity fields, role behavior, positive-like sorting, filtering/pagination, inactive visibility, admin content immutability, comment rules, locking and ownership restrictions.

`npm run test:auth` is the additional hardening suite. It runs only on an explicitly disposable test database and checks:

- concurrent/single-use password reset behavior;
- email-change credential revocation and re-verification;
- non-destructive `db:init` and refusal of an unconfirmed reset;
- last-administrator protection;
- avatar decoding/re-encoding from real image contents;
- concurrent reputation changes on different contribution targets.

GitHub Actions first resets `usof_ci`, runs syntax and hardening tests, then starts the API and executes the public/PDF-specific/Creative HTTP verification before building and rendering the frontend.

## Not a Basic blocker

Creative features such as Favorites, subscriptions, notifications, extra reactions and dashboards are optional additions. The `Share` section asks the student to publish a reflective LinkedIn post; that remains an external/manual submission step rather than backend source-code functionality.
