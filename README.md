# Usof

Usof is a local full-stack programming Q&A service inspired by Stack Overflow. It includes a Node.js/Express/MySQL API and a React + Redux frontend. The implementation follows the required `API/` + `web/` repository layout.

## Features

- registration, email verification, login, real logout and password reset
- `user` and `admin` roles with backend authorization and ownership checks
- user profiles, avatar upload and automatically maintained rating
- posts with many-to-many categories, active/inactive moderation, locking, search, sorting, filtering and pagination
- nested comments through `parent_comment_id`, moderation and locking
- like/dislike reactions for posts and comments with one reaction per user/target
- admin user/category/post/comment management
- responsive React UI covering guest, user and admin flows
- centralized JSON errors, input validation and parameterized SQL
- GitHub Actions CI with MySQL 8.4, API smoke tests and React production build

## Stack

JavaScript, Node.js, Express, MySQL, HTML, CSS, React and Redux.

## Requirements

- Node.js 20+
- npm 10+
- MySQL 8+

## Setup

```bash
git clone https://github.com/Anastasia2627/usof.git
cd usof
npm install
cp .env.example .env
```

Edit `.env` with your local MySQL credentials and a strong `AUTH_SECRET`.

Initialize the development database. This recreates the tables inside the configured `DB_NAME`, so use a dedicated development database:

```bash
npm run db:init
```

Start the API:

```bash
npm start
```

In a second terminal, start the React client:

```bash
npm run web
```

Open `http://localhost:5173`.

## Seed accounts

Development seed password for all accounts: `Password123!`

- `admin` / `admin@usof.local` — admin
- `asya`, `alex`, `maria`, `sam` — users

Do not use these credentials outside local development.

## API overview

- `/api/auth` — registration, verification, login/logout and password reset
- `/api/users` — profiles, avatar upload and admin user management
- `/api/posts` — post CRUD, pagination, sorting/filtering, reactions and comments
- `/api/categories` — category CRUD and posts by category
- `/api/comments` — admin listing, comment moderation, reactions and deletion

The post feed supports `page`, `limit`, `sort=likes|date`, `order=asc|desc`, `category`, `from`, `to`, `status`, `author` and `search`. Visibility rules are always applied on the backend.

## Frontend pages and flows

The React client includes the home feed with filters/search/pagination, login, registration, email verification, password reset, categories, profile editing, avatar upload, create/edit post, post details, nested replies, post/comment reactions, moderation controls, and an admin console for users, posts, categories and comments.

The header/menu is present on every page and shows service name, search, navigation, current role/login/avatar and logout for authorized users.

## Architecture

Backend request flow:

`HTTP request → route → auth/validation → controller/service/model → MySQL → JSON response`

The backend separates configuration, middleware, controllers, models, services, database initialization and uploads. React uses a central API client and Redux only for global authentication/session state. No third-party UI framework is used.

## Testing

Run syntax checks and the full smoke suite while the API/MySQL are available:

```bash
npm run check:backend
npm run test:smoke
npm run build
```

GitHub Actions runs these checks automatically on `main` using a MySQL service container. The first CI run on commit `4510998` completed successfully, including database initialization, backend syntax validation, API smoke flow and React production build.

## Documentation / CBL progress

- **Engage:** defined Usof as a knowledge exchange service for programmers.
- **Investigate:** selected the required Node.js/Express/MySQL + React/Redux stack and role-aware API architecture.
- **Act:** implemented the database schema, backend modules, integrated responsive client, validation, security checks and automated verification.

Main user flow: open app → register → verify email → login → browse/filter posts → create post → comment/reply → react → edit own content/profile → upload avatar → logout.

Main admin flow: login → open admin console → manage users/roles → moderate posts/comments → manage categories → inspect inactive/locked content → logout.

## Screenshots

The assignment requires real screenshots of the application in use. They should be captured from the running local app after final visual review; fake/generated screenshots are intentionally not included.

## Current verification status

Automated CI has verified MySQL initialization/seed, backend syntax, API startup, public and authenticated smoke flows, and React production build. The expanded frontend is committed and will be re-verified by CI on its latest commit. Manual browser visual review at mobile/tablet/desktop widths and final screenshots are still required before treating the submission as completely finished.
