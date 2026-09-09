# Usof

Usof is a local full-stack programming Q&A service inspired by Stack Overflow. It includes a Node.js/Express/MySQL API and a React + Redux frontend. The implementation follows the required `API/` + `web/` repository layout.

## Features

- registration, email verification flow, login, logout and password reset flow
- `user` and `admin` roles with backend authorization checks
- user profiles, avatar upload, automatically maintained rating
- posts with many-to-many categories, active/inactive moderation, sorting, filtering and pagination
- comments and replies through `parent_comment_id`
- like/dislike reactions for posts and comments with one reaction per user/target
- admin-only user/category management endpoints and moderation capabilities
- responsive React interface with main feed, search, auth, profile, post, create-post, categories and admin pages
- centralized JSON errors and parameterized SQL

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

Initialize the development database (this recreates the tables inside the configured `DB_NAME`):

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

- `/api/auth` — registration, verification, login/logout, password reset
- `/api/users` — profiles and admin user management
- `/api/posts` — post CRUD, pagination, sorting/filtering, reactions, comments
- `/api/categories` — category CRUD and category posts
- `/api/comments` — comment state, reactions and deletion

The public post feed supports `page`, `limit`, `sort=likes|date`, `order=asc|desc`, `category`, `from`, `to`, `status` (admin visibility rules apply) and `search`.

## Architecture

The backend separates routes, middleware, controllers, models/services and database configuration. React uses a central API client and Redux for authentication/global session state. No UI framework is used.

## Documentation / CBL progress

- **Engage:** defined Usof as a knowledge exchange service for programmers.
- **Investigate:** selected the required Node.js/Express/MySQL + React/Redux stack and role-aware API architecture.
- **Act:** implemented the database schema, backend modules and an integrated responsive client.

Main flow: browser → React/Redux → Fetch API → Express route → auth/validation → controller/service → MySQL → JSON response → UI.

## Screenshots

Real application screenshots will be added after the project is run locally with MySQL and the final UI is verified.

## Current verification status

Source structure and JavaScript syntax can be checked without MySQL. Full database/API integration requires a running local MySQL server and configured `.env`.
