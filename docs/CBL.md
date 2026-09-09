# CBL progress journal

This document records the progress from the Challenge Based Learning stages used for the Usof backend and frontend challenges.

## Engage

**Big idea:** knowledge and experience exchange.

**Essential question:** how can a web service help programmers exchange useful knowledge with minimal friction?

**Challenge interpretation:** build the API first, then create a responsive React interface over the same data and permissions. The core product should let a visitor find useful questions quickly while giving signed-in users a clear path to ask, answer, react and manage their own content. Administration must be separated from normal user capabilities.

The first scope decision was to keep the Basic requirements complete before adding optional features. The important entities were identified as users, posts, categories, comments and likes/dislikes, with a many-to-many post/category relationship and nested comments.

## Investigate

### Backend findings

- A relational database fits the challenge because users, posts, categories, comments and reactions have strong relationships and integrity rules.
- MySQL foreign keys and unique indexes can enforce important invariants in addition to application validation.
- Passwords must be hashed rather than stored directly; authorization decisions must be made on the server.
- A JWT alone is not enough for a meaningful logout if it remains valid until expiry, so Usof combines JWT authentication with a database `token_version` that can invalidate existing sessions.
- Email confirmation and password reset need expiring random tokens. SMTP is optional in local development so the complete flow can still be tested.
- Rating is derived from reactions received by a user's posts and comments, so changes to reactions/dependent content must keep rating synchronized.
- Nested replies are naturally represented by a self-reference from a comment to its parent comment.

### Frontend findings

- A single-page React client is a good fit because feed filters, forms, profile/admin views and nested discussions share navigation and session state.
- Redux is useful for global authentication/session information, but putting every form/filter into Redux would add unnecessary complexity. Page-local state is kept inside components.
- The interface needs the same role rules as the API for usability, but the frontend must never be the security boundary.
- Responsive layouts should be designed as part of the component/CSS structure rather than treated as a final patch.
- Clear validation messages and loading/empty states are necessary because the client depends on an asynchronous API.

### Planned architecture

The project was divided into:

`route → authentication/validation → controller → model/service → MySQL`

and on the client:

`shared header/router → page component → API client → Redux session or local page state`.

This kept the required `API/` and `web/` parts independent enough to understand and test while still living in one repository.

## Act

### Backend implementation

1. Created a reproducible MySQL schema and development seed.
2. Implemented user/admin roles and server-side authorization.
3. Added registration, email verification, login, logout and password reset.
4. Added users, posts, categories, comments and reactions with the required CRUD/moderation behavior.
5. Added multi-category posts, active/inactive visibility, post/comment locking, pagination, sorting and filtering.
6. Added nested comments and one like/dislike per user/target.
7. Added transactional rating recalculation and cascading database relations.
8. Added local avatar storage, upload validation and cleanup of replaced files.
9. Split data access into entity models (`User`, `Category`, `Post`, `Comment`, `Reaction`) plus services for cross-entity behavior.
10. Added centralized JSON error responses and defensive validation.

### Frontend implementation

1. Built the React/Redux client without a third-party UI framework.
2. Added a shared header/menu with service name, search, navigation, current account/role/avatar and persistent logout.
3. Built the recent-question feed with filters, search, sorting and pagination.
4. Added category browsing and category-specific post pages.
5. Added registration/verification/login/password-reset flows.
6. Added create/edit question flows with multiple categories.
7. Added post discussion pages with nested replies, likes/dislikes and reaction inspection/removal.
8. Added profile editing, avatar upload, own-post filters/pagination and account deletion.
9. Added the protected admin console for users, posts, categories and comments.
10. Added responsive layouts and explicit loading/error/empty states.

## Verification and iteration

The project was not treated as finished after the first successful launch. A GitHub Actions pipeline was added to recreate MySQL, run syntax checks, start the real API, execute public and authenticated smoke flows, build/start React and capture real desktop/mobile browser screenshots.

The smoke flow exercises authentication invalidation, CRUD operations, moderation, nested comments, reactions and rating updates. CI feedback was also used to fix the screenshot workflow itself when the mobile capture initially requested a browser that had not been installed.

## Result and reflection

The final solution keeps the Basic requirements visible in the code rather than hiding them behind a framework: routes are explicit, SQL relations can be inspected, role checks are server-side, React pages map directly to user/admin flows, and the project can be recreated locally from the repository.

The most important architectural lesson was that features such as real logout, comment nesting, rating and content visibility are easier to implement reliably when their data model and permission rules are decided before building the interface. Automated verification then made later refactoring safer because regressions in the API or frontend build are detected immediately.

For the current route reference and requirement mapping, see `docs/API.md` and `docs/ASSESSMENT.md`.
