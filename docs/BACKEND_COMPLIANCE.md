# Backend PDF compliance audit

This document maps the mandatory **Usof backend — Track Full Stack (August 31, 2026)** requirements to the implementation. It is intentionally stricter than a feature summary: each Basic requirement is tied to code or an automated verification path.

## Act: Basic — platform and architecture

| PDF requirement | Implementation / proof |
| --- | --- |
| Allowed stack: JS, Node.js, Express, MySQL | Root `package.json`, `API/`, Express application and MySQL driver. |
| Develop API server and relational MySQL database | `API/app.js`, `API/server.js`, `API/src/config/db.js`. |
| Admin panel available only to admins | React `/admin` console plus backend `requireAdmin` protection on admin API operations. The UI is not the security boundary. |
| Database created/recreated on initialization | `npm run db:init` creates the configured database, drops/recreates all core tables and reseeds them. |
| User photos stored on local server filesystem | `API/uploads/avatars/`; database stores only the relative avatar path. |
| At least five test rows in every table | Seed creates 5 users, 6 categories, 6 posts, 12 post-category rows, 6 comments and 8 reactions. `scripts/verify-backend-requirements.mjs` checks every core table automatically. |
| Informative error handling | Central `errorHandler`, stable JSON error codes/messages, validation errors, upload errors, malformed JSON handling and 404 handler. |
| MVC | Routes → controllers → models/services → MySQL, documented in `docs/ARCHITECTURE.md`. |
| OOP | Entity classes `User`, `Post`, `Category`, `Comment`, `Reaction` inherit from `BaseModel`; `AppError` is a reusable error class. |
| SOLID-oriented design | Routing, authorization, data access, mail, reaction/rating behavior, uploads and errors have separate responsibilities. |
| Validate requests and role access | IDs, body values, statuses, dates, categories, roles, files, ownership and admin-only operations are checked server-side. |

## Admin functionality

| PDF requirement | Implementation |
| --- | --- |
| Log in | `POST /api/auth/login`. |
| Log out | `POST /api/auth/logout`; increments `token_version`, invalidating old bearer tokens. |
| Reset password | Request + confirm endpoints with expiring reset token; password reset invalidates old sessions. |
| Create user/admin | `POST /api/users`, admin-only. The PDF-required `role` parameter is explicitly required. |
| See all profiles | `GET /api/users`, admin-only. |
| Update profile data | `PATCH /api/users/:user_id`, admin can update login/email/full name/role. |
| Delete users | `DELETE /api/users/:user_id`, admin can delete any user. |
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
| Create one like/dislike per target | Database unique indexes + transactional upsert; an admin reaction belongs to the same admin account. |
| See all likes | Admin may inspect reactions on active or inactive posts/comments. |
| Delete likes | Admin may delete own reaction or clear all reactions on a target with `?all=1`. |

## User functionality

| PDF requirement | Implementation |
| --- | --- |
| Everyone can register | Public `POST /api/auth/register`. New accounts always receive role `user`. |
| Confirm that email belongs to user | Expiring verification token/link; login is blocked until verified. |
| Log in / log out / reset password | Implemented in authentication module. |
| Create posts | `POST /api/posts` with title, content and at least one valid category. |
| See active posts + own inactive posts | Visibility is enforced in both list and detail endpoints. |
| Update own post | Owner can update title/content/categories; cannot set moderation status/lock. |
| Delete own post | Owner/admin authorization check. |
| Create comments under active posts | Enforced server-side; locked discussions additionally reject normal-user comments. |
| See all comments for the specified viewable post | `/api/posts/:post_id/comments` returns all comment rows/statuses once the post itself is viewable. |
| “update any” comment — only active/inactive status | Implemented literally: any authenticated user can change status of any comment belonging to a post that user may access. Comment content cannot be edited. |
| Delete comments | A normal user may delete their own comment; admin may delete any. |
| One like/dislike per post or comment | Unique database constraints and upsert semantics. |
| See likes under specified active post/comment | Non-admin reaction-list endpoints require an active target; admin may inspect inactive targets. |
| Delete self-created likes | DELETE reaction routes remove only the current user's reaction unless admin explicitly requests clear-all. |

## Required entity fields

### User

- `login` — unique database column.
- `password` — stored only as bcrypt `password_hash`.
- `full_name`.
- `email` — unique and verified before login.
- `avatar` — local file path.
- `rating` — stored and automatically recalculated from reactions received by posts/comments.
- `role` — `ENUM('user','admin')`, default `user`; normal users cannot change it.

### Post

- author: `author_id` foreign key.
- title.
- publish date: `created_at`.
- status: active/inactive.
- content.
- categories: many-to-many `post_categories`; several categories are supported.

Post images are described in the PDF as **highly recommended**, not mandatory, so they are not treated as a Basic blocker.

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
- type: `like` or `dislike`.

The database check constraint guarantees exactly one target and unique indexes guarantee one reaction per user/target.

## Endpoint surface

The implementation provides the PDF endpoint structure plus a few documented additions:

- Authentication: register, email verification, login, logout, password reset request/confirm.
- Users: list, detail, admin create, avatar upload, update, delete.
- Posts: list/detail/comments/categories/reactions, create/update/delete, add/remove reaction.
- Categories: list/detail/posts, create/update/delete.
- Comments: detail/reactions, add/remove reaction, update status, delete; `/api/comments` is an additional admin listing endpoint.

Exact methods/access/payloads are documented in `docs/API.md`.

## Sorting, filtering and pagination

`GET /api/posts` supports:

- pagination with `page` and `limit`;
- default sorting by **number of positive likes**, as the PDF states;
- sorting by date;
- ascending/descending order;
- filtering by category;
- filtering by date interval;
- filtering by active/inactive status;
- additional author and text-search filters.

The dedicated requirement test creates two posts with the same net score but a different positive-like count, so CI would fail if `sort=likes` were accidentally changed back to net score.

## Locking

Posts and comments have `locked` fields. Normal users cannot add comments/replies/reactions to locked discussion targets and cannot edit a locked post/comment status. Admins may lock/unlock and continue moderation.

## Documentation requirement

The repository contains:

- a README with short description, real screenshots, requirements/dependencies and clone-to-run instructions;
- `docs/CBL.md` with progress/reflection for Engage, Investigate and Act;
- `docs/ARCHITECTURE.md` with whole-program architecture/algorithm and main flows;
- `docs/API.md` with endpoint documentation;
- this requirement-by-requirement audit;
- real running-app screenshots in `docs/screenshots/`.

## Automated proof

`npm run test:requirements` performs PDF-specific checks against a real running API/MySQL instance, including:

- five-or-more rows in every core table;
- required entity columns;
- bcrypt password storage and unique login;
- valid reaction target shape;
- explicit admin role on admin-created accounts;
- admin role changes;
- positive-like sorting rather than net-score sorting;
- category/date/status filtering and pagination;
- owner/admin inactive-post visibility;
- admin post-content immutability;
- active-target reaction-list rule;
- literal “update any comment status” behavior;
- all-comments listing;
- comment-content immutability;
- non-owner comment deletion denial;
- post locking;
- non-owner post edit denial.

This runs after the broader public/authenticated smoke tests inside GitHub Actions.

## Not a Basic blocker

`Act: Creative` features such as Favorites/subscriptions/notifications are explicitly optional. The `Share` section asks the student to publish a reflective LinkedIn post; that is an external/manual submission step rather than backend source-code functionality.
