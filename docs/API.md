# API reference

Base URL: `http://localhost:5000/api`

All protected routes expect `Authorization: Bearer <token>`. JSON errors use the shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable explanation"
  }
}
```

## Authentication

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register a user. Requires `login`, `email`, `password`, `passwordConfirmation`; `fullName` is optional. New registrations always receive role `user`. |
| POST | `/auth/verify-email/:token` | Public | Confirm the email address. |
| POST | `/auth/login` | Public | Log in with `login` or `email` plus `password`. Email must already be confirmed. |
| POST | `/auth/logout` | User/Admin | Invalidates existing bearer tokens for the current account. |
| POST | `/auth/password-reset` | Public | Creates a short-lived reset token and sends a reset link when SMTP is configured. |
| POST | `/auth/password-reset/:confirm_token` | Public | Changes the password and invalidates old sessions. |

In non-production environments the registration/reset token is also returned in the JSON response so the complete flow can be tested without SMTP. Production responses never expose these tokens.

## Users

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/users` | Admin | List all user/admin profiles. |
| GET | `/users/:user_id` | User/Admin | Read a profile. |
| POST | `/users` | Admin | Create a verified user/admin account. Requires `login`, `email`, `password`, `passwordConfirmation` and explicit `role=user|admin`; `fullName` is optional. |
| PATCH | `/users/avatar` | User/Admin | Upload the current user's JPEG/PNG/WEBP avatar (`multipart/form-data`, field `avatar`, max 3 MB). |
| PATCH | `/users/:user_id` | Owner/Admin | Owner can edit `fullName`; admin can also edit login, email and role. Changing email revokes sessions and reset tokens, and requires email verification. |
| DELETE | `/users/:user_id` | Owner/Admin | Delete an account and cascading content. |

The `rating` field is maintained automatically from reactions received by the user's posts and comments. Reaction weights are `like +1`, `dislike -1`, `useful +2`, `thanks +1`, `fire +1`. Self-reactions are rejected so reputation cannot be increased by reacting to your own contribution.

Trust is a presentation layer over rating: Newcomer below 10, Contributor at 10, Trusted at 30, Expert at 75 and Mentor at 150.

## Posts

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/posts` | Public | List viewable posts with pagination, filters and sorting. |
| GET | `/posts/:post_id` | Public | Read one viewable post. |
| GET | `/posts/:post_id/comments` | Public | Read all comments/statuses for a viewable post. Comments are sorted by positive-like count ascending by default. |
| POST | `/posts/:post_id/comments` | User/Admin | Create a comment or reply (`parentCommentId` is optional). Normal users require an active, unlocked target. |
| GET | `/posts/:post_id/categories` | Public | Read the post categories. |
| GET | `/posts/:post_id/like` | Public/Admin | Non-admin callers can read reactions only for an active post; admins can inspect inactive posts too. |
| POST | `/posts` | User/Admin | Create a post with `title`, `content` and one or more category IDs. |
| POST | `/posts/:post_id/like` | User/Admin | Set the current user's reaction. One reaction exists per user/target. |
| PATCH | `/posts/:post_id` | Owner/Admin | Owner edits title/content/categories. Admin moderates status/categories/lock, but attempts to edit a user's title/content are rejected. |
| DELETE | `/posts/:post_id` | Owner/Admin | Delete a post and its dependent data. |
| DELETE | `/posts/:post_id/like` | User/Admin | Delete the current reaction. Admin may use `?all=1` to clear all reactions on the post. |

### Post list parameters

`GET /posts` supports:

- `page` and `limit` for pagination (`limit` is capped at 50)
- `sort=likes|date|trending` — `likes` means the number of positive `like` reactions and is the Basic default; `trending` is the Creative recent-activity score
- `order=asc|desc`
- `category=<category_id>`
- `from=<date>` and `to=<date>`
- `status=active|inactive`
- `author=<user_id>`
- `search=<text>`

Normal visitors see active posts. An authenticated user additionally sees their own inactive posts. Admins can see active and inactive posts.

## Categories

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/categories` | Public | List categories. |
| GET | `/categories/:category_id` | Public | Read one category. |
| GET | `/categories/:category_id/posts` | Public | Read viewable posts belonging to the category. |
| POST | `/categories` | Admin | Create a category. |
| PATCH | `/categories/:category_id` | Admin | Edit a category. |
| DELETE | `/categories/:category_id` | Admin | Delete a category. |

## Comments

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/comments` | Admin | Admin listing used by the moderation console. |
| GET | `/comments/:comment_id` | Public | Read a comment when its parent post is viewable. Comment status is returned rather than silently removing inactive comments. |
| GET | `/comments/:comment_id/like` | Public/Admin | Non-admin callers can read reactions only when both comment and parent post are active; admin can inspect inactive targets. |
| POST | `/comments/:comment_id/like` | User/Admin | Set a reaction; normal users require an active, unlocked discussion target. |
| PATCH | `/comments/:comment_id` | User/Admin | The PDF's “update any” rule is implemented literally: any authenticated user may change `status=active|inactive` on any comment attached to a post they can access. Admin may additionally lock/unlock. Comment content is immutable for everyone. |
| DELETE | `/comments/:comment_id` | Owner/Admin | Delete the comment (dependent replies are deleted by the database relation). |
| DELETE | `/comments/:comment_id/like` | User/Admin | Delete the current reaction. Admin may use `?all=1` to clear all reactions. |

## Saved questions, following and sharing

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/posts/:post_id/engagement` | User/Admin | Read the current user's saved/following state for a question. |
| POST | `/posts/:post_id/favorite` | User/Admin | Save a question. |
| DELETE | `/posts/:post_id/favorite` | User/Admin | Remove a saved question. |
| POST | `/posts/:post_id/follow` | User/Admin | Follow a discussion for updates. |
| DELETE | `/posts/:post_id/follow` | User/Admin | Stop following a discussion. |
| POST | `/posts/:post_id/share` | Public | Record a share channel (`native`, `copy`, `facebook`, `x`, `telegram`, `other`). |
| GET | `/library/favorites` | User/Admin | Paginated saved-question library. |
| GET | `/library/following` | User/Admin | Paginated followed-question library. |

Library lists accept `page`, `limit`, `sort=date|likes|trending` and `order=asc|desc`.

## Notifications

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | User/Admin | Paginated notification list. `unread=1` limits it to unread items. |
| PATCH | `/notifications/:notification_id/read` | Owner | Mark one notification as read. |
| PATCH | `/notifications/read-all` | User/Admin | Mark the current user's notifications as read. |
| DELETE | `/notifications/:notification_id` | Owner | Delete one notification. |

Notifications cover new answers, replies, followed-discussion updates and positive reactions. The service avoids notifying a user about their own action.

## Dashboards

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/dashboard/me` | User/Admin | Personal contribution dashboard: trust, community rank, weekly goal, streak, achievements, reaction signals, saved/following counts and questions worth answering. |
| GET | `/dashboard/admin` | Admin | Platform dashboard: totals, seven-day activity, top contributors/categories, reaction mix and moderation context. |

The user dashboard is motivational rather than administrative. The admin dashboard is intentionally separate from `/admin`: the dashboard summarizes platform health while the admin console performs CRUD/moderation work.

## Health check

`GET /api/health` verifies that the API can actively reach MySQL and returns `{ "status": "ok" }`; database failure is reported as a 503 JSON error.

## Role and visibility rules

Authorization is enforced on the server rather than relying on the React interface. A regular user cannot use admin endpoints by manually calling the API. Post inactivity follows the challenge rule: all users see active posts and an authenticated owner can additionally see their own inactive posts. Comment status remains visible on a viewable post because the PDF explicitly requires users to see all comments and allows any authenticated user to change comment status. Locking prevents regular users from adding new reactions/replies/comments to locked discussions, while an admin can still moderate them.

For the requirement-by-requirement source audit, see `docs/BACKEND_COMPLIANCE.md`. Creative behavior is summarized in `docs/CREATIVE_FEATURES.md`.

### Email changes

When an admin changes a user's email, the update clears email confirmation and existing password reset tokens, replaces the verification token (24-hour expiry), and invalidates all existing sessions. The new address receives a confirmation link; login remains blocked until confirmation. Profile updates and a normalized unchanged, verified email preserve sessions and tokens.

The PATCH response includes `sessionInvalidated` and, when a verification email is attempted, `emailDelivery` (`sent`, `failed`, or `not-configured`). Non-production responses also include `verificationToken`, as registration does. If delivery fails, the address stays unverified; an admin can PATCH the same unverified email again to issue a fresh link. This invalidates the previous verification link. An admin changing their own address is also signed out and must confirm the new address.

Auth regression tests: after initializing a disposable test database, run `NODE_ENV=test DB_NAME=usof_test npm run test:auth` with the matching DB connection variables. Tests require a database name ending in `_test` or `_ci`, create their own users, and remove them afterward. Never initialize a database containing data you need to keep.
