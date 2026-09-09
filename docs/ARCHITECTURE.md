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

- public: registration, verification, login/reset, active posts/categories/comments/reaction lists
- user: create/edit own posts, comment/reply, react, edit own profile/avatar, delete own account/content
- admin: all user/category CRUD plus moderation of posts/comments and visibility of inactive content

Post/comment locking is checked by the API before normal users can add replies/reactions. Frontend controls mirror these permissions but do not replace them.

## Database model

Core tables:

- `users`
- `categories`
- `posts`
- `post_categories` (many-to-many)
- `comments` (self-referencing `parent_comment_id` for replies)
- `reactions` (post or comment target, `like`/`dislike`)

Foreign keys use cascading deletion where dependent content belongs to the deleted parent. Unique indexes enforce one reaction per user and target. Post/category associations use a composite primary key.

The seed contains at least five rows for each core entity/table and demonstrates active/inactive content, nested comments, categories and reactions.

## Rating

A user's rating is the sum of reactions received by all of their posts and comments:

- `like` = `+1`
- `dislike` = `-1`

Rating recalculation is performed inside the same transaction as reaction/deletion operations that can change the result. This keeps the stored rating synchronized with source data.

## Frontend layout

`web/src/App.jsx` is a small hash-route dispatcher. Individual views live in `web/src/pages/`, shared interface pieces in `web/src/ui.jsx`, and API/network behavior in `web/src/api.js`.

Redux is deliberately limited to global session state. Feed filters, forms, pagination and page-specific data stay in component state. The session is persisted to local storage so a page refresh does not immediately log the user out; the server still validates the token on protected calls.

## Main flows

### User

1. Register.
2. Verify email.
3. Log in.
4. Browse/search/filter/sort/paginate questions.
5. Create a question with several categories.
6. Comment or reply to another comment.
7. Like/dislike a post or comment.
8. Edit own question/profile/avatar or hide own comment.
9. Delete own reaction/content/account when needed.
10. Log out from the persistent header.

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

Client forms use native constraints where appropriate, but every important rule is also validated on the API because frontend validation can be bypassed. SQL values are parameterized. Errors are returned as JSON with stable error codes and human-readable messages. Unexpected production errors do not expose stack traces or database internals.

## Automated verification

GitHub Actions starts MySQL 8.4, installs dependencies, checks backend syntax, recreates/seed the database, starts the API, runs public and authenticated smoke flows, builds the React client and captures real browser screenshots at desktop and mobile widths.

The smoke flow covers authentication invalidation, CRUD, moderation, nested comments, reactions and rating updates rather than testing only the health endpoint.
