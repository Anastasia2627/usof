# Assessment checklist

This checklist maps the Basic challenge requirements to the implementation and gives a short verification path for peer assessment. For the exhaustive backend source-to-code matrix, see `docs/BACKEND_COMPLIANCE.md`.

## Backend — Act: Basic

| Requirement | Implementation / verification |
| --- | --- |
| JavaScript, Node.js, Express, MySQL | Root `package.json`, `API/`, MySQL schema in `API/database/init.js`. |
| API + relational database | Express modules under `/api`; MySQL 8 schema with foreign keys, unique constraints, check constraint and indexes. |
| Database is recreated on initialization | `npm run db:init` creates the configured DB, recreates tables and seeds data. Use a dedicated development DB. |
| At least five test entries per table | Seed includes 5 users, 6 categories, 6 posts, 12 post-category links, 6 comments and 8 reactions. Dedicated requirement test queries every table. |
| Local file storage for user photos | Avatar upload stores files under `API/uploads/avatars/`. |
| Informative errors | Central JSON error handler plus validation/upload/JSON error codes/messages. |
| MVC / OOP / SOLID-oriented structure | Separate routes/controllers/models/services/middleware/config; reusable model base and entity classes/services. See `docs/ARCHITECTURE.md`. |
| `user` and `admin` roles | Role stored in users; default registration role is user; middleware checks current DB role on authenticated requests; only admin may change roles. |
| Admin panel / admin CRUD | React `/admin` console plus admin-protected API routes. |
| Registration + confirmed email | Register → expiring verification token/link → login blocked until verified. |
| Login / logout / reset password | Implemented under `/api/auth`; logout/reset invalidate old bearer tokens. |
| Users CRUD | Admin: create/list/update/delete. Admin-created accounts require explicit role. User: read/edit own profile/avatar and delete own account. |
| Posts CRUD | Create/read/update/delete, multi-category relation, active/inactive moderation. Owner edits own content/categories; admin cannot edit user content. |
| Categories CRUD | Full admin CRUD + public reads/category posts. |
| Comments | Create/read/status moderation/delete plus nested replies through `parent_comment_id`; all comments/statuses are returned for a viewable post. |
| User comment status rule | PDF's “update any” is implemented literally: any authenticated user may change active/inactive status on an accessible comment, but content is immutable. |
| Likes/dislikes | One reaction per user/target; update/remove; list reactions; admin clear-all. Non-admin listing requires an active target. |
| Automatic rating | Like = +1, dislike = -1 over received post/comment reactions; recalculated transactionally. |
| Lock posts/comments | Admin lock/unlock controls; normal user additions/reactions are rejected on locked targets. |
| Post sorting | `sort=likes` is the default and counts positive likes exactly; `sort=date` is also supported. |
| Post filtering | Category, date interval and status; author/search are useful additional filters. |
| Pagination | `page` + `limit`, with metadata in the response. |
| Request validation + role-aware access | Positive IDs, content lengths, category existence, dates/status/role/file checks, backend ownership/admin checks. |

Exact routes and payload notes are in `docs/API.md`.

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
| User profile | Profile/avatar editing, rating, own posts, category/status/sort controls and pagination. |
| Own post editing | Create/edit page supports title, content and multiple categories. |
| Post preview contains actual API data | Score, author, date, status, title, content preview and categories. |
| Comment comments | Nested reply composer and recursive thread rendering. |
| Comments sorted ascending by likes | API currently provides deterministic ascending discussion ordering; frontend review remains tracked separately from this backend audit. |
| Responsive | Mobile/tablet breakpoints; automated 390 px screenshot plus desktop screenshots. |
| Relevant input errors | Native form validation plus readable API error box. |
| Runs locally | `npm start` for API and `npm run web` for Vite client. |
| Footer (Creative suggestion) | Shared footer is included across the application. |

## Documentation

README contains project description, requirements/dependencies, complete local launch instructions, seed credentials, feature/architecture summary, CBL progress, and real screenshots. Detailed API/architecture/CBL/compliance notes live in `docs/`.

## Quick assessor demo

1. `npm install`, copy `.env.example` to `.env`, configure MySQL and `AUTH_SECRET`.
2. `npm run db:init`.
3. Terminal A: `npm start`.
4. Terminal B: `npm run web`.
5. Open `http://localhost:5173`.
6. Guest: browse/filter/search questions, open a post/categories.
7. User: log in as `asya` / `Password123!`; create/edit a question, reply to a comment, like/dislike, edit profile/avatar, log out.
8. Admin: log in as `admin` / `Password123!`; open Admin, manage users/categories, deactivate/lock content, inspect reactions.

## Automated check

GitHub Actions independently verifies database initialization, API start, backend syntax, public/authenticated smoke flows, the PDF-specific backend requirements audit and the React production build. It also renders the real running app and captures desktop/mobile screenshots.

For a backend-only local verification while the API/MySQL are running:

```bash
npm run test:requirements
```
