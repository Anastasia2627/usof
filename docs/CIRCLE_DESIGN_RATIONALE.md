# Circle Studio — UX / dashboard rationale

This design pass keeps the original USOF backend and the core post → comment → reaction content model. The product positioning is **Circle: an open social space for conversations**, rather than a programming-only Q&A website, as permitted by the updated course brief.

## Visual direction

- Black / near-black editorial base, layered violet radial lighting, elegant soft gradients, large but purposeful typography, thin purple borders and translucent cards.
- 3D-inspired depth is created with CSS rather than adding large imagery or expensive animation assets. The landing hero is shorter so real conversations appear sooner.
- Responsive layouts use 4/3/2-column reductions and intentional mobile fallbacks.
- Visible keyboard focus and reduced-motion support; decorative shapes do not contain critical information.

## User dashboard — Circle Space

Data source: existing `GET /api/dashboard/me` endpoint.

| Widget | Existing data |
| --- | --- |
| Contribution reputation and trust ring | `trust.rating`, `trust.name`, `trust.progress` |
| Member rank | `stats.communityRank`, `stats.contributors` |
| Posts and replies | `stats.posts`, `stats.answers` |
| Received reactions | `stats.positiveReactionsReceived`, `reactionsReceived` |
| Contribution streak | `stats.contributionStreak` |
| Bookmarks and followed threads | `stats.favorites`, `stats.following` |
| Weekly participation goal | `weeklyGoal`, based on replies |
| Milestones and suggested discussions | `achievements`, `suggestions` |

No invented financial metrics, unsupported profile views or fictitious follower counts. “Streak” measures days of contributions, not consecutive days merely opening the site.

## Admin dashboard — Admin Studio

Data source: existing `GET /api/dashboard/admin` endpoint.

- Primary KPIs: users, users registered in the last seven days, posts, reactions.
- Seven-day community activity: users, posts, replies and reactions per day.
- Moderation context: hidden/locked posts and comments. This is **not** presented as a user-report queue; there is no reports entity in the existing API.
- Top contributors, active topics and received-reaction mix.
- Secondary metrics remain accessible but take less visual weight.

## Interaction corrections

- Public post cards now open for visitors, matching the public GET endpoint contract.
- “For you” was an alias of “Latest” with no personalisation. The misleading duplicate tab was removed.
- A visible link to the personal dashboard replaces the non-functional Messages placeholder in primary navigation; the placeholder route itself remains.
- When the development frontend falls back to `mockApi` without the backend, dashboards display a visible “Preview mode” warning. The Admin Studio preview derives its example counts from in-browser sample entities and does not claim MySQL data.

## Verification

Run `npm run build`, test `/#/`, `/#/register`, `/#/dashboard` with a logged-in user, `/#/admin/dashboard` with an admin; repeat at mobile widths. Live database tests require MySQL and the API running.

## UX references

- NN/g: https://www.nngroup.com/articles/vanity-metrics/ (actionable measures, not vanity numbers).
- W3C: https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html (reduced-motion preference).
- Original backend/frontend challenge PDF documents (provided separately) define the required data entities and interaction model.
