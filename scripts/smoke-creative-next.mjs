const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
const seedPassword = process.env.USOF_SEED_PASSWORD || 'Password123!';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = 'GET', token, body, expected = 200 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function login(loginName) {
  return request('/auth/login', {
    method: 'POST',
    body: { login: loginName, password: seedPassword },
  });
}

const [admin, asya, alex, maria] = await Promise.all([
  login('admin'),
  login('asya'),
  login('alex'),
  login('maria'),
]);
const categories = await request('/categories');
const stamp = Date.now();
const post = await request('/posts', {
  method: 'POST',
  token: alex.token,
  expected: 201,
  body: {
    title: `Creative feature check ${stamp}`,
    content: 'A temporary question used to verify saved posts, following, notifications, sharing and dashboards.',
    categories: [categories.data[0].id],
  },
});

const postId = Number(post.data.id);
const alexBefore = await request(`/users/${alex.user.id}`, { token: asya.token });

await request(`/posts/${postId}/like`, {
  method: 'POST', token: alex.token, body: { type: 'like' }, expected: 409,
});

await request(`/posts/${postId}/favorite`, { method: 'POST', token: asya.token, expected: 201 });
await request(`/posts/${postId}/follow`, { method: 'POST', token: asya.token, expected: 201 });
await request(`/posts/${postId}/follow`, { method: 'POST', token: maria.token, expected: 201 });
const engagement = await request(`/posts/${postId}/engagement`, { token: asya.token });
assert(engagement.data.favorite === true, 'Saved state was not persisted');
assert(engagement.data.following === true, 'Follow state was not persisted');

const favorites = await request('/library/favorites?limit=50', { token: asya.token });
assert(favorites.data.some((item) => Number(item.id) === postId), 'Saved post is missing from the library');
const following = await request('/library/following?limit=50', { token: asya.token });
assert(following.data.some((item) => Number(item.id) === postId), 'Followed post is missing from the library');

const shared = await request(`/posts/${postId}/share`, { method: 'POST', body: { channel: 'copy' }, expected: 201 });
assert(shared.data.shareCount >= 1, 'Share tracking did not increment');
await request(`/posts/${postId}/share`, { method: 'POST', body: { channel: 'invalid' }, expected: 422 });

await request(`/posts/${postId}/like`, { method: 'POST', token: asya.token, body: { type: 'useful' } });
const alexAfterUseful = await request(`/users/${alex.user.id}`, { token: asya.token });
assert(Number(alexAfterUseful.data.rating) === Number(alexBefore.data.rating) + 2, 'Useful reaction should add two reputation points');

const answer = await request(`/posts/${postId}/comments`, {
  method: 'POST', token: asya.token, expected: 201,
  body: { content: 'This answer also verifies the notification flow.' },
});
await request(`/comments/${answer.data.id}/like`, {
  method: 'POST', token: asya.token, body: { type: 'like' }, expected: 409,
});

const alexNotifications = await request('/notifications?unread=1&limit=50', { token: alex.token });
const questionNotice = alexNotifications.data.find((item) => Number(item.post_id) === postId);
assert(questionNotice, 'Question author did not receive a notification for a new answer');
await request(`/notifications/${questionNotice.id}/read`, { method: 'PATCH', token: alex.token });
const alexUnreadAfterRead = await request('/notifications?unread=1&limit=50', { token: alex.token });
assert(!alexUnreadAfterRead.data.some((item) => Number(item.id) === Number(questionNotice.id)), 'Read notification still appears in the unread list');

const mariaNotifications = await request('/notifications?unread=1&limit=50', { token: maria.token });
assert(mariaNotifications.data.some((item) => Number(item.post_id) === postId && item.type === 'comment'), 'A follower did not receive the new answer notification');

await request(`/comments/${answer.data.id}/like`, { method: 'POST', token: alex.token, body: { type: 'thanks' } });
await request(`/comments/${answer.data.id}/like`, { method: 'POST', token: maria.token, body: { type: 'like' } });
const asyaNotifications = await request('/notifications?unread=1&limit=50', { token: asya.token });
assert(asyaNotifications.data.some((item) => Number(item.comment_id) === Number(answer.data.id) && item.type === 'reaction'), 'Answer author did not receive a positive reaction notification');

const mariaAnswer = await request(`/posts/${postId}/comments`, {
  method: 'POST', token: maria.token, expected: 201,
  body: { content: 'A second answer verifies literal ascending like-count ordering.' },
});
const orderedComments = await request(`/posts/${postId}/comments`);
const roots = orderedComments.data.filter((item) => !item.parent_comment_id);
assert(roots.every((item) => Number.isFinite(Number(item.like_count))), 'Comments are missing like_count');
for (let index = 1; index < roots.length; index += 1) {
  assert(Number(roots[index - 1].like_count) <= Number(roots[index].like_count), 'Comments are not sorted by likes ascending');
}
assert(Number(roots[0].id) === Number(mariaAnswer.data.id), 'Zero-like answer should sort before the older liked answer');

const userDashboard = await request('/dashboard/me', { token: asya.token });
assert(userDashboard.data.trust?.name, 'User dashboard is missing the trust level');
assert(Number.isFinite(userDashboard.data.stats.answers), 'User dashboard is missing answer stats');
assert(Number.isFinite(userDashboard.data.stats.communityRank), 'User dashboard is missing community rank');
assert(userDashboard.data.stats.contributors >= 1, 'User dashboard is missing contributor count');
assert(Array.isArray(userDashboard.data.achievements), 'User dashboard is missing achievements');
assert(Array.isArray(userDashboard.data.suggestions), 'User dashboard is missing answer suggestions');
assert(userDashboard.data.weeklyGoal?.target === 5, 'User dashboard weekly goal is invalid');

await request('/dashboard/admin', { token: asya.token, expected: 403 });
const adminDashboard = await request('/dashboard/admin', { token: admin.token });
assert(Number.isFinite(adminDashboard.data.overview.users), 'Admin dashboard is missing user totals');
assert(Number.isFinite(adminDashboard.data.overview.moderation_posts), 'Admin dashboard is missing moderation post totals');
assert(Number.isFinite(adminDashboard.data.overview.moderation_comments), 'Admin dashboard is missing moderation comment totals');
assert(Array.isArray(adminDashboard.data.growth) && adminDashboard.data.growth.length === 7, 'Admin dashboard growth series is invalid');
assert(Array.isArray(adminDashboard.data.topContributors), 'Admin dashboard is missing contributors');

const trending = await request('/posts?sort=trending&order=desc&limit=10');
assert(trending.data.every((item) => item.trend_score !== undefined), 'Trending feed is missing trend scores');
assert(trending.data.every((item) => item.author_rating !== undefined), 'Post previews are missing author reputation');

await request(`/posts/${postId}/like`, { method: 'DELETE', token: asya.token, expected: 204 });
const alexAfterRemoval = await request(`/users/${alex.user.id}`, { token: asya.token });
assert(Number(alexAfterRemoval.data.rating) === Number(alexBefore.data.rating), 'Removing a creative reaction should restore reputation');
await request(`/posts/${postId}/favorite`, { method: 'DELETE', token: asya.token, expected: 204 });
await request(`/posts/${postId}/follow`, { method: 'DELETE', token: asya.token, expected: 204 });
await request(`/posts/${postId}/follow`, { method: 'DELETE', token: maria.token, expected: 204 });
const engagementAfterRemoval = await request(`/posts/${postId}/engagement`, { token: asya.token });
assert(!engagementAfterRemoval.data.favorite && !engagementAfterRemoval.data.following, 'Library state did not clear');

await request('/notifications/read-all', { method: 'PATCH', token: asya.token });
await request(`/posts/${postId}`, { method: 'DELETE', token: alex.token, expected: 204 });

console.log('Creative engagement, trust, notifications, ordering and dashboard smoke tests passed.');
