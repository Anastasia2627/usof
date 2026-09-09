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
auth + validation middleware
        |
controllers / services / models
        |
        v
MySQL 8
```

Uploaded avatars are stored in `API/uploads/avatars/` and only the path is stored in MySQL.

## Backend layout

- `API/app.js` creates the Express application and mounts modules.
- `API/server.js` validates the database connection and starts the HTTP server.
- `API/database/init.js` recreates the schema and inserts reproducible development data.
- `API/src/routes/` defines the public/protected endpoint surface.
- `API/src/controllers/` contains request-specific orchestration and validation.
- `API/src/models/` contains reusable entity/data-access abstractions.
- `API/src/services/` contains cross-entity behavior such as reactions/rating and email delivery.
- `API/src/middleware/` contains authentication, admin authorization, upload handling and centralized errors.

The separation keeps routing, authorization, request orchestration, data access and cross-cutting behavior from being mixed into one server file. The model classes use a shared `BaseModel`, and services encapsulate behavior that affects several entities. This is the project's practical MVC/OOP/SOLID boundary.

## Authentication

JWT payloads contain a user id and `token_version`, not a trusted role copied permanently into the token. Every authenticated request resolves the current user from MySQL. Logout, password reset and identity/role changes increment `token_version`, which makes already issued tokens unusable.

Only users with a verified email can log in. Verification and password-reset tokens expire. Passwords are hashed with bcrypt and are never returned by profile endpoints.

## Authorization

The backend is the source of truth for permissions:

- public: registration, verification, login/reset, active posts/categories, comments belonging to viewable posts, and reaction lists for active targets;
- user: create/edit/delete own posts, create comments/replies, change any accessible comment's active/inactive status as required by the PDF, react, edit own profile/avatar, delete own comments/reactions/account;
- admin: user/category CRUD, visibility of inactive posts, moderation of posts/comments, locking, and reaction inspection/clear-all.

Post inactivity follows the explicit challenge rule: visitors see active posts, an authenticated user additionally sees their own inactive posts, and admins see everything. The PDF separately says users must see all comments for a specified post and may “update any” comment only by changing active/inactive status, so the API returns all comments/statuses once their parent post is viewable. Comment content remains immutable.

Locking is an additional control required by the PDF: normal users cannot add replies/reactions/comments to locked targets, while admins can continue moderation.

## Database model

Core tables:

- `users`
- `categories`
- `posts`
- `post_categories` (many-to-many)
- `comments` (self-referencing `parent_comment_id` for replies)
- `reactions` (post or comment target, `like`/`dislike`)

Foreign keys use cascading deletion where dependent content belongs to the deleted parent. Unique indexes enforce one reaction per user and target. A check constraint requires every reaction to reference exactly one post or one comment. Post/category associations use a composite primary key.

The seed contains at least five rows for each core table and demonstrates active/inactive content, nested comments, categories and reactions. `scripts/verify-backend-requirements.mjs` verifies those seed counts and the required entity columns in CI.

## Rating

A user's rating is the sum of reactions received by all of their posts and comments:

- `like` = `+1`
- `dislike` = `-1`

Rating recalculation is performed inside the same transaction as reaction/deletion operations that can change the result. This keeps the stored rating synchronized with source data.

Post feed `sort=likes` deliberately uses the number of positive `like` reactions, not this net rating/score formula, because the PDF says sorting must be by number of likes.

## Frontend layout

`web/src/App.jsx` is a small hash-route dispatcher. Individual views live in `web/src/pages/`, shared interface pieces in `web/src/ui.jsx`, and API/network behavior in `web/src/api.js`.

Redux is deliberately limited to global session state. Feed filters, forms, pagination and page-specific data stay in component state. The session is persisted to local storage so a page refresh does not immediately log the user out; the server still validates the token on protected calls.

## Main flows

### User

1. Register.
2. Verify email.
3. Log in.
4. Browse/search/filter/sort/paginate questions.
5. Create a question with one or several categories.
6. Comment or reply on an active, unlocked post.
7. Like/dislike an active, unlocked post or comment.
8. Edit own question/profile/avatar.
9. Change a comment's active/inactive status where required by the backend assignment.
10. Delete own content/reactions/account when needed.
11. Log out.

### Admin

1. Log in as an admin.
2. Open the protected admin console.
3. Create/update/delete users and change roles.
4. Create/update/delete categories.
5. Inspect active/inactive posts/comments.
6. Change post categories/status, lock/unlock discussions, moderate comments and delete content.
7. Inspect/clear reactions from the content view.
8. Log out.

## Validation and errors

Client forms use native constraints where appropriate, but every important rule is also validated on the API because frontend validation can be bypassed. SQL values are parameterized. Errors are returned as JSON with stable error codes and human-readable messages. Malformed JSON, upload-limit errors and excessive database field lengths receive client-facing validation responses. Unexpected production errors do not expose stack traces or database internals.

## Automated verification

GitHub Actions starts MySQL 8.4, installs dependencies, checks backend syntax, recreates/seeds the database, starts the API, runs public and authenticated smoke flows, then runs the PDF-specific `scripts/verify-backend-requirements.mjs` audit. It also builds the React client and captures real browser screenshots at desktop and mobile widths.

The requirement audit checks schema/seed invariants and deliberately exercises edge cases that mirror the PDF wording: positive-like sorting vs net score, inactive-post visibility, admin content immutability, all-comments visibility, the unusual “update any comment status” rule, active-target reaction listing, locking and ownership restrictions.
