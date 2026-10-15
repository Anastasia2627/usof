# Circle — product UX notes

## Positioning
Circle is an open social discussion space, not exclusively a programmer forum.
The original technical entity model — users, posts, topics/categories, threaded comments, reactions and an admin role — remains unchanged.

## Reduced navigation
Only the Home feed and Explore need permanent navigation links. When signed in, the header also contains New post, Notifications and Profile. The personal activity dashboard, saved posts and followed conversations are accessed from profile/dashboard, not as independent top-level destinations. The not-yet-implemented Messages placeholder was removed.

## Feed first
The landing page is the real posts feed. We removed the marketing billboard, ornamental sample quote cards and exaggerated secondary labels. Posts are displayed immediately with clear sorting and filters. Guest posts can be opened without registering.

## Visual direction and quality rules
Keep near-black backgrounds, a restrained violet accent, deliberate typography, and the recognizable mascot in the auth screen. Avoid ubiquitous purple fog, glassmorphism, evenly repeated oversized cards, decorative fake analytics, needless uppercased microcopy, and hovering/translating cards as generic cues.

## Dashboards
- Member: real posts, replies, reactions received, saved count, replies this week, reputation and links to functional saved/followed/notification pages.
- Admin: real totals, last-seven-days post/reply activity, moderation attention items and popular topics.
- Never show fake community totals as if they came from MySQL.

## Registration
- Demo uses the same visible UI, with fake local data and direct feed navigation; no backend/email.
- Real user registers, verifies via genuine SMTP email (code or one-time link), then logs in to see the feed.
- Ordinary web mode must not silently fall back to mock data.

## UX references
- NN/g: https://www.nngroup.com/articles/aesthetic-minimalist-design/
- NN/g: https://www.nngroup.com/articles/ai-ux-debt/
- AI-slop patterns: https://smoothui.dev/blog/ai-design-slop
