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
| POST | `/auth/register` | Public | Register a user. Requires `login`, `email`, `password`, `passwordConfirmation`; `fullName` is optional. |
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
| POST | `/users` | Admin | Create a verified user/admin account. |
| PATCH | `/users/avatar` | User/Admin | Upload the current user's JPEG/PNG/WEBP avatar (`multipart/form-data`, field `avatar`, max 3 MB). |
| PATCH | `/users/:user_id` | Owner/Admin | Owner can edit `fullName`; admin can also edit login, email and role. |
| DELETE | `/users/:user_id` | Owner/Admin | Delete an account and cascading content. |

The `rating` field is maintained automatically from likes/dislikes received by the user's posts and comments.

## Posts

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/posts` | Public | List viewable posts with pagination, filters and sorting. |
| GET | `/posts/:post_id` | Public | Read one viewable post. |
| GET | `/posts/:post_id/comments` | Public | Read the comments visible for the post. |
| POST | `/posts/:post_id/comments` | User/Admin | Create a comment or reply (`parentCommentId` is optional). |
| GET | `/posts/:post_id/categories` | Public | Read the post categories. |
| GET | `/posts/:post_id/like` | Public | Read reactions on the post. |
| POST | `/posts` | User/Admin | Create a post with `title`, `content` and one or more category IDs. |
| POST | `/posts/:post_id/like` | User/Admin | Set the current user's `like` or `dislike`. One reaction exists per user/target. |
| PATCH | `/posts/:post_id` | Owner/Admin | Owner edits title/content/categories; admin moderates status/lock and categories without editing content. |
| DELETE | `/posts/:post_id` | Owner/Admin | Delete a post and its dependent data. |
| DELETE | `/posts/:post_id/like` | User/Admin | Delete the current reaction. Admin may use `?all=1` to clear all reactions on the post. |

### Post list parameters

`GET /posts` supports:

- `page` and `limit` for pagination (`limit` is capped at 50)
- `sort=likes|date`
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
| GET | `/comments/:comment_id` | Public | Read a visible comment. |
| GET | `/comments/:comment_id/like` | Public | Read reactions on a comment. |
| POST | `/comments/:comment_id/like` | User/Admin | Set a `like` or `dislike`. |
| PATCH | `/comments/:comment_id` | Owner/Admin | Change status; admins may additionally lock/unlock. Content is not edited. |
| DELETE | `/comments/:comment_id` | Owner/Admin | Delete the comment (dependent replies are deleted by the database relation). |
| DELETE | `/comments/:comment_id/like` | User/Admin | Delete the current reaction. Admin may use `?all=1` to clear all reactions. |

## Health check

`GET /api/health` is used by CI and local diagnostics to verify that the API can reach MySQL.

## Role and visibility rules

Authorization is enforced on the server rather than relying on the React interface. A regular user cannot use admin endpoints by manually calling the API. Locking prevents regular users from adding new reactions/replies/comments to locked discussions, while an admin can still moderate them.
