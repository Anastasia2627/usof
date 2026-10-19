# Circle · UX review and final design pass (October 2026)

This review is grounded in the course's **Usof backend.pdf** (Basic requirements),
the 20-step defense checklist in `docs/DEFENSE_20_STEPS.md`, and the current
React/Express implementation. It does not change the course assignment's
allowed roles, post/comment update rules, moderation invariants or database schema.

## Product direction

- **Minimal and friendly**: warm neutral monochrome palette, subtle borders,
  near-black primary actions, soft 16–20 px surface corners, no decorative blur.
- **Icon-only where clear**: vote/save/share, post menus, notifications delete,
  account bell, navigation. Each icon button has an accessible name and/or title.
- **Icon + text for commitments**: publish, apply/reset filters, follow, edit,
  moderator assignment and other consequential actions.
- **Consistency**: reusable radii, control heights, spacings, focus-visible
  outlines, reduced-motion handling and dark theme.
- **Mobile**: compact 390 px feed, readable card contents, touch-sized actions,
  vertical stacking of longer settings fields. No decorative horizontal overflow.

## Reviewed user flows

| Flow | Expected behavior and UX |
| --- | --- |
| Guest home / search / categories | Public read-only content with search and meaningful sign-in options |
| Sort and filter | Likes by default, publication date asc/desc, categories, status, date interval, reset all |
| Publish | Required title/body/category, Markdown preview, photo preview and upload, optional schedule |
| Draft | Text/categories/setting choices saved only in the browser tab; clear draft button; photo files must be reselected after reload |
| Post detail | Readable typography, reply thread, compact reactions, save, fullscreen photos, share/copy link |
| Feed cards | Consistent rounded cards, social interactions, copying a direct post link without opening it |
| Empty feed | Explain no matches and provide reset control instead of dead-end empty text |
| Profiles | Editing and picture updates, ratings, posts and filters, role indicator |
| Moderation | Admin-only role changes, notifications, appropriate moderator actions, protected admin content |
| Notifications | Clear unread status, mark all read, small icon-only per-item delete |
| Authentication | Login, registration/email verification, reset password, stable role changes in the same session |
| Preferences | Local theme/language settings with selected state |

## Requirements guardrails

The mandatory course flows remain implemented: registration and login/logout,
role separation, posts/categories/comments/reactions CRUD within access rules,
user ratings, locking, sorting, filtering and pagination. These are covered by
the existing backend audits and the automated 20-step defense rehearsal.

Optional UX improvements are separate from the mandatory PDF specification.
Copy link is entirely client-side; it does not create a new database table.
Tab-scoped text drafts deliberately do not upload files or expose server drafts.

## Implementation

- `web/src/ux-polish.css`: small finishing layer loaded after earlier style
  files. All surfaces remain native React + CSS; no new UI dependencies.
- `web/src/ui.jsx`: accessible post share action in feed cards.
- `web/src/pages/PostPage.jsx`: detail share action, stray gallery character fix.
- `web/src/pages/HomePage.jsx`: helpful resettable empty feed.
- `web/src/pages/NotificationsPage.jsx`: icon-only delete, clearer batch action.
- `web/src/pages/PostEditor.jsx`: recoverable, per-user, tab-scoped text draft.
- `web/src/preferences.jsx`: Ukrainian/Russian labels for the new controls.

## Validation

GitHub Actions runs the normal backend/security suites, build, UI checks at
390 px and desktop widths, and the 20-step defense flow.
`scripts/test-ui-regressions.mjs` also tests draft restoration, discard,
share link copying and card radius across viewports.

Manual check before presentation: first visit, mobile navigation, filter menu,
publish with images, preview, clipboard permission behavior, profile editing,
author/moderator/admin roles, and dark mode. **Do not reset a non-test database.**
