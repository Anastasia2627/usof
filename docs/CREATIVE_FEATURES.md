# Creative features

Usof keeps the assignment's core Q&A flow intact and layers a small community system on top of it.

## Reputation and trust

Reputation is calculated from reactions received on a user's questions and answers. A user cannot react to their own contribution.

Reaction weights:

- `like`: +1
- `dislike`: -1
- `useful`: +2
- `thanks`: +1
- `fire`: +1

Trust levels are intentionally simple and transparent:

- Newcomer: below 10 reputation
- Contributor: 10+
- Trusted: 30+
- Expert: 75+
- Mentor: 150+

The user dashboard shows the current trust level, progress to the next level, community rank, contribution streak, weekly answer goal, achievements, received reaction signals, and questions that still need an answer.

## Saved questions and following

Saved questions are a personal reading list. Following is separate: it means the user wants updates about a discussion. Both lists support pagination and sorting.

Followers can receive notifications when a question is updated or when a new answer/reply appears. Authors also receive notifications about answers, replies and positive reactions to their own contributions.

## Sharing and trending

The post page supports native browser sharing, copy-link sharing, Facebook, X and Telegram. The backend records only the share channel and the related post/user where available.

Trending is a recent-activity signal built from reactions, answers, saves and shares in the last 14 days. It is used for ordering, not for reputation.

## Dashboards

`GET /api/dashboard/me` returns personal contribution progress and answer suggestions.

`GET /api/dashboard/admin` is admin-only and returns platform totals, seven-day growth, top contributors, top categories, reaction distribution and moderation context.

The admin dashboard is intentionally separate from the CRUD admin console: the dashboard explains what is happening; the console is where an admin changes data.

## Related endpoints

- `GET /api/posts/:post_id/engagement`
- `POST|DELETE /api/posts/:post_id/favorite`
- `POST|DELETE /api/posts/:post_id/follow`
- `POST /api/posts/:post_id/share`
- `GET /api/library/favorites`
- `GET /api/library/following`
- `GET /api/notifications`
- `PATCH /api/notifications/:notification_id/read`
- `PATCH /api/notifications/read-all`
- `DELETE /api/notifications/:notification_id`
- `GET /api/dashboard/me`
- `GET /api/dashboard/admin`

`npm run test:creative` exercises the main creative flows against a real MySQL-backed API.