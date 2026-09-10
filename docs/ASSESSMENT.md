# Assessment checklist

This checklist maps the Basic challenge requirements to the implementation and gives a short verification path for peer assessment. For the exhaustive backend source-to-code matrix, see `docs/BACKEND_COMPLIANCE.md`.

## Backend — Act: Basic

| Requirement | Implementation / verification |
| --- | --- |
| JavaScript, Node.js, Express, MySQL | Root `package.json`, `API/`, MySQL schema in `API/database/init.js`. |
| API + relational database | Express modules under `/api`; MySQL 8 schema with foreign keys, unique constraints, check constraint and indexes. |
| Database can be initialized/recreated | `npm run db:init` creates/seeds a fresh schema but never drops existing data. An intentional rebuild uses guarded `npm run db:reset -- --confirm=<DB_NAME>`; CI resets only a disposable `_ci` database. |
| At least five test entries per table | Seed includes at least five records in every challenge table; dedicated requirement tests query the database directly. |
| Local file storage for user photos | Avatars are decoded, normalized to WebP and stored under `API/uploads/avatars/`; MySQL stores the relative path. |
| Informative errors | Central JSON error handler plus validation/upload/JSON/database error codes/messages. |
| MVC / OOP / SOLID-oriented structure | Routes, thin controllers, entity models, focused services, middleware, config and shared validators are separated. See `docs/ARCHITECTURE.md`. |
| `user` and `admin` roles | Role stored in users; default registration role is user; middleware checks the current DB role; only admin may change roles; the last admin cannot be deleted or demoted. |
| Admin panel / admin CRUD | React `/admin` console plus admin-protected API routes. |
| Registration + confirmed email | Register → expiring verification token/link → login blocked until verified. |
| Login / logout / reset password | Implemented under `/api/auth`; logout/reset invalidate old bearer tokens; reset-token consumption is race-safe. |
| Users CRUD | Admin: create/list/update/delete. User: read/edit own profile/avatar and delete own account. Email changes revoke stale credentials and require verification. |
| Posts CRUD | Create/read/update/delete, multi-category relation, active/inactive moderation. Owner edits own content/categories; admin cannot edit user content. |
| Categories CRUD | Full admin CRUD + public reads/category posts. |
| Comments | Create/read/status moderation/delete plus nested replies through `parent_comment_id`; all comments/statuses are returned for a viewable post. |
| User comment status rule | PDF's “update any” is implemented literally: any authenticated user may change active/inactive status on an accessible comment, but content is immutable. |
| Likes/dislikes | Required `like`/`dislike` flow is present with one reaction per user/target, update/remove/list and admin clear-all. Creative reaction types extend the same mechanism. |
| Automatic rating | Basic like/dislike remains +1/-1; Creative types use documented weights. Self-voting is rejected and concurrent reactions update reputation through atomic deltas. |
| Lock posts/comments | Admin lock/unlock controls; normal user additions/reactions are rejected on locked targets. |
| Post sorting | `sort=likes` is the Basic default and counts positive likes exactly; `sort=date` is supported, with Creative `sort=trending` separately. |
| Post filtering | Category, full date interval and status; author/search are useful additional filters. |
| Pagination | `page` + `limit`, with metadata in the response. |
| Request validation + role-aware access | Shared common validators plus entity-specific validation, backend ownership/admin checks and decoded avatar validation. |

Exact routes and payload notes are in `docs/API.md`.

## Backend hardening checks

The implementation also protects several cases beyond the happy-path challenge requirements:

- normal `db:init` is non-destructive and refuses partial schemas;
- destructive reset is separate and explicitly confirmed outside disposable test databases;
- a reset-password token can only be consumed once even under concurrent requests;
- changing email invalidates active sessions, reset credentials and old verification credentials;
- avatars are accepted by decoded image content rather than client-supplied MIME type and are re-encoded as WebP;
- the system cannot lose its final administrator through delete or role change;
- concurrent reactions on separate contributions of one author cannot overwrite the stored reputation.

`npm run test:auth` contains focused regression tests for these invariants.

## Frontend — Act: Basic

| Requirement | Implementation / verification |
| --- | --- |
| HTML + CSS + React + Redux | React client in `web/`; Redux used for authentication/session state. No UI framework. |
| Full interface for backend | Auth, users/profile, posts, categories, comments/replies, reactions and admin moderation are represented in the client. |
| Header + menu on every page | `App.jsx` renders the shared `Header` around all routes. |
| Service name + site search | USOF brand and post/author/text search in the shared header. |
| Role + login + avatar for current user | Profile control is rendered in the header after login. |
| Logout available on every page | Shared header logout invalidates server session and clears Redux/local storage. |
| Main page | Recent feed, post previews, search/filter/sort and pagination. |
| User profile | Profile/avatar editing, reputation/trust, own posts, category/status/sort controls and pagination. |
| Own post editing | Create/edit page supports title, content and multiple categories. |
| Post preview contains actual API data | Reputation score, author/trust, date, status, title, content preview, categories and activity metrics. |
| Comment comments | Nested reply composer and recursive thread rendering. |
| Comments sorted ascending by likes | API returns comments ordered by positive `like_count` ascending, then creation time/id for deterministic ties. The client preserves that order. |
| Responsive | Mobile/tablet breakpoints; automated 390 px screenshot plus desktop screenshots. |
| Relevant input errors | Native form validation plus readable API error box. |
| Runs locally | `npm start` for API and `npm run web` for Vite client. |
| Footer (Creative suggestion) | Shared footer is included across the application. |

## Creative layer

The Creative pass adds saved questions, followed discussions, notifications, sharing, Trending sorting, five reaction types, a transparent trust ladder, community rank, achievements, contribution streaks, weekly answer goals and a recommendation list of questions that still need an answer.

The user dashboard (`/dashboard`) is focused on contribution and motivation. The admin dashboard (`/admin/dashboard`) is intentionally separate from the CRUD console (`/admin`) and focuses on platform activity, top contributors/categories, reaction mix and moderation context.

The backend for every Creative feature is documented in `docs/API.md` and `docs/CREATIVE_FEATURES.md`, and `npm run test:creative` exercises the main flows against MySQL.

## Documentation

README contains project description, requirements/dependencies, safe database setup/reset instructions, seed credentials, feature/architecture summary, CBL progress and real screenshots. Detailed API/architecture/CBL/compliance notes live in `docs/`.

## Quick assessor demo

1. `npm install`, copy `.env.example` to `.env`, configure MySQL and `AUTH_SECRET`.
2. For a fresh database run `npm run db:init`. To deliberately restore seed data later, use `npm run db:reset -- --confirm=<DB_NAME>`.
3. Terminal A: `npm start`.
4. Terminal B: `npm run web`.
5. Open `http://localhost:5173`.
6. Guest: browse/filter/search questions, try Newest/Most liked/Trending, open a post and categories.
7. User: log in as `asya` / `Password123!`; open Dashboard, answer a question, save/follow another question, use reactions/share, inspect Notifications and Saved, edit profile/avatar and own content.
8. Admin: log in as `admin` / `Password123!`; open Admin dashboard, inspect activity/moderation signals, then use Manage content to open the CRUD console and manage users/categories/posts/comments.

## Automated check

GitHub Actions explicitly resets a disposable MySQL `_ci` database, verifies backend syntax, runs focused account/data hardening tests, starts the API, runs public/PDF-specific/Creative HTTP suites and builds the React client. It also renders the real running app and captures desktop/mobile screenshots.

For focused local verification on a disposable test database:

```bash
npm run test:auth
npm run test:requirements
npm run test:creative
```
