# Architecture and implementation notes

## Overview

Usof is a single-repository full-stack application with the required `API/` and `web/` directories.

```text
Browser (React + Redux)
        |
        | HTTP / JSON
        v
Express routes
        |
auth / role middleware
        |
controllers
        |
services + models
        |
        v
MySQL 8 / local avatar storage
```

Controllers translate HTTP requests and responses. Services own validation-heavy business flows, transaction boundaries and cross-entity rules. Models provide reusable data access. This keeps access policy and data-integrity rules from being repeated across controllers.

## Backend layout

- `API/app.js` creates the Express application and mounts modules.
- `API/server.js` validates the database connection and starts the HTTP server.
- `API/database/init.js` safely initializes a fresh schema; destructive reseeding is an explicit guarded reset mode.
- `API/src/routes/` defines the public/protected endpoint surface.
- `API/src/controllers/` contains thin HTTP orchestration.
- `API/src/models/` contains reusable entity/data-access abstractions.
- `API/src/services/` contains account lifecycle, authentication, post/comment/category behavior, avatar processing, reactions/rating, notifications and dashboards.
- `API/src/utils/validation.js` contains shared normalization and common validators.
- `API/src/middleware/` contains authentication, admin authorization, multipart handling and centralized errors.

The model classes use a shared `BaseModel`. Services are split by responsibility rather than collected into one large application service. This is the project's practical MVC/OOP/SOLID boundary without adding an unnecessary framework layer.

## Database initialization and reset

`npm run db:init` is non-destructive. It creates and seeds a new Usof schema only when none of the application tables exists. If the complete schema already exists, it exits without changing data. If it sees a partial Usof schema, it refuses to continue instead of silently overwriting or trying an unsafe migration.

Destructive development reset is separate:

```bash
npm run db:reset -- --confirm=<DB_NAME>
```

The exact database name is required as confirmation outside automated tests. Under `NODE_ENV=test`, a database whose name ends in `_test` or `_ci` may be reset without the extra argument because it is explicitly disposable. CI uses this path.

## Authentication and account lifecycle

JWT payloads contain a user id and `token_version`, not a role that stays trusted forever. Every authenticated request resolves the current user from MySQL. Logout, password reset and identity/role changes increment `token_version`, invalidating previously issued sessions.

Only users with a verified email can log in. Passwords are hashed with bcrypt. Verification and password-reset tokens expire and are never returned in production responses.

Password reset is race-safe: after bcrypt hashing, the final password update still matches both the same token hash and an unexpired timestamp. If another request has already consumed, replaced or expired the link, the update affects zero rows and the reset fails.

When an admin changes a user's email, the account transaction resets email verification, replaces the verification token, removes password-reset credentials and invalidates existing sessions. Saving a normalized unchanged verified address does not revoke the account unnecessarily.

## Administrator invariant

The application must always retain at least one admin. Admin role changes and admin deletion run inside a transaction that locks the current admin rows before checking the invariant. A request that would demote or delete the final administrator fails with `LAST_ADMIN_REQUIRED`.

This lock is important: checking only `COUNT(*)` before the update would still allow two concurrent requests to each believe another admin remains.

## Avatar processing

The multipart middleware holds the upload in memory and enforces the 3 MB request-file limit. It deliberately does not trust `file.mimetype` as proof of the contents.

`avatarService` decodes the buffer with `sharp`. Only decoded JPEG, PNG and WebP input is accepted. Invalid bytes, unsupported formats, excessive dimensions and animated images are rejected. Valid input is rotated according to orientation, resized to at most 512 x 512 without enlargement and re-encoded as WebP before being written to `API/uploads/avatars/`. MySQL stores only the relative path.

Replacing an avatar removes the previous local avatar after the new image and database update succeed. A failed save cleans up the new file instead of leaving an orphan.

## Authorization and visibility

The backend remains the source of truth for permissions:

- public: registration, verification, login/reset, active posts/categories, comments belonging to viewable posts and reaction lists for active targets;
- user: create/edit/delete own posts, create comments/replies, change any accessible comment's active/inactive status as required by the PDF, react, edit own profile/avatar and delete own comments/reactions/account;
- admin: user/category CRUD, visibility of inactive posts, moderation of posts/comments, locking and reaction inspection/clear-all.

Post inactivity follows the challenge rule: visitors see active posts, an authenticated user additionally sees their own inactive posts, and admins see everything. The PDF separately says users must see all comments for a specified post and may “update any” comment by changing active/inactive status, so the API returns all comments/statuses once their parent post is viewable. Comment content remains immutable.

Locking prevents normal users from adding replies/reactions/comments to locked discussion targets while admins can continue moderation.

## Database model

Core challenge tables are:

- `users`
- `categories`
- `posts`
- `post_categories`
- `comments`
- `reactions`

Creative/community tables are:

- `favorites`
- `post_subscriptions`
- `post_shares`
- `notifications`

`post_categories` implements many-to-many categories. Comments use self-referencing `parent_comment_id`. Reactions point to exactly one post or comment through a database check constraint, and unique keys enforce one reaction per user/target. Foreign keys clean dependent data when a parent is deleted.

The seed contains at least five rows per challenge table and also seeds the Creative tables. `scripts/verify-backend-requirements.mjs` verifies the required schema and data invariants against MySQL.

## Reputation and concurrency

Reaction weights are:

- `like` = `+1`
- `dislike` = `-1`
- `useful` = `+2`
- `thanks` = `+1`
- `fire` = `+1`

Self-reactions are rejected.

The normal reaction path does not recalculate the author's entire rating and then write an absolute value. Instead it calculates the reaction delta — for example, changing `like` to `dislike` means `-2` — and applies `UPDATE users SET rating = rating + ?`. MySQL serializes concurrent writes to the same user row, so reactions occurring at the same time on different posts/comments cannot overwrite one another's contribution.

Full `recalculateUserRating` / `recalculateAllRatings` remain repair tools for destructive parent deletions. They lock the affected user rows before rebuilding the stored value from reaction source data.

Post feed `sort=likes` deliberately uses positive `like` count rather than reputation score because the challenge explicitly requests sorting by number of likes. Comment ordering likewise uses positive likes ascending before deterministic date/id tie-breakers.

## Service boundaries

The core request path is intentionally split:

- `authController` → `authService`: registration, verification, login/logout and password reset.
- `usersController` → `accountService` / `avatarService`: account administration, session-impacting identity changes, last-admin protection and image processing.
- `postsController` → `postService`: post validation, visibility, CRUD transactions and follower-update behavior.
- `commentsController` → `commentService`: comment visibility, nested replies, moderation and deletion.
- `categoriesController` → `categoryService`: category validation and CRUD behavior.
- reaction orchestration → `reactionService`: reaction uniqueness, self-vote policy and rating mutations.
- notification/dashboard controllers → their dedicated model/services.

Small controller-specific HTTP choices stay in controllers. Cross-entity rules and transaction code do not.

## Frontend layout

`web/src/App.jsx` is a small hash-route dispatcher. Individual views live in `web/src/pages/`, shared interface pieces in `web/src/ui.jsx`, and API/network behavior in `web/src/api.js`.

Redux is deliberately limited to global session state. Feed filters, forms, pagination and page-specific data stay in component state. The session is persisted to local storage so a page refresh does not immediately log the user out; the server still validates the token on protected calls.

## Main flows

### User

1. Register and verify email.
2. Log in.
3. Browse/search/filter/sort/paginate questions.
4. Create a question with one or several categories.
5. Comment or reply on an active, unlocked post.
6. React to another user's active contribution.
7. Save/follow discussions and read notifications.
8. Use the contribution dashboard, trust progress and answer suggestions.
9. Edit own question/profile/avatar.
10. Delete own content/reactions/account when needed.
11. Log out.

### Admin

1. Log in as an admin.
2. Open the protected admin dashboard or CRUD console.
3. Create/update/delete users and change roles while preserving at least one administrator.
4. Create/update/delete categories.
5. Inspect active/inactive posts/comments.
6. Change post categories/status, lock/unlock discussions, moderate comments and delete content.
7. Inspect/clear reactions from content views.
8. Log out.

## Validation and errors

Client forms use native constraints where appropriate, but important rules are validated on the API because frontend validation can be bypassed. Common identifiers, email/login/password/full-name, roles and statuses reuse shared validators. Entity-specific rules remain in the corresponding service.

SQL values are parameterized. Errors are returned as JSON with stable error codes and human-readable messages. Malformed JSON, upload-limit errors and database constraint failures receive client-facing responses. Unexpected production errors do not expose stack traces or database internals.

## Automated verification

GitHub Actions starts a disposable MySQL 8.4 database and explicitly resets it, then runs backend syntax checks and `npm run test:auth`. The hardening suite covers password-reset races, email/token lifecycle, last-admin protection, avatar content decoding, safe database initialization and concurrent rating updates.

After that CI starts the API, runs the public smoke check plus PDF-specific and Creative HTTP suites, builds the React client, starts the real frontend and captures browser screenshots at desktop and mobile widths.

The PDF-specific suite separately checks schema/seed invariants and requirement wording such as positive-like sorting, inactive-post visibility, admin content immutability, all-comments visibility, comment-status updates, active-target reaction listing, locking and ownership restrictions.
