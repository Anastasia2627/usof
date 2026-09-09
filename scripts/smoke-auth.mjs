const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';

async function request(path, {
  method = 'GET',
  token,
  body,
  formData,
  expected = 200,
} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: formData || (body === undefined ? undefined : JSON.stringify(body)),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const stamp = String(Date.now());
const login = `smoke_${stamp.slice(-8)}`;
const email = `${login}@example.com`;
const password = `S-${stamp}-Aa9!`;
const newPassword = `N-${stamp}-Bb8!`;

const registration = await request('/auth/register', {
  method: 'POST',
  expected: 201,
  body: { login, email, password, passwordConfirmation: password, fullName: 'Smoke User' },
});
assert(registration.verificationToken, 'Development verification token missing');

await request('/auth/register', {
  method: 'POST',
  expected: 409,
  body: { login, email, password, passwordConfirmation: password },
});
await request('/auth/login', {
  method: 'POST',
  expected: 403,
  body: { login, email, password },
});
await request(`/auth/verify-email/${registration.verificationToken}`, { method: 'POST' });
await request(`/auth/verify-email/${registration.verificationToken}`, { method: 'POST', expected: 400 });

let session = await request('/auth/login', {
  method: 'POST',
  body: { login, email, password },
});
const firstToken = session.token;

await request('/users', { token: firstToken, expected: 403 });
const profile = await request(`/users/${registration.user.id}`, { token: firstToken });
assert(profile.data.login === login, 'User profile lookup failed');
const updatedProfile = await request(`/users/${registration.user.id}`, {
  method: 'PATCH',
  token: firstToken,
  body: { fullName: 'Smoke User Updated' },
});
assert(updatedProfile.data.full_name === 'Smoke User Updated', 'Profile update failed');
await request(`/users/${registration.user.id}`, {
  method: 'PATCH',
  token: firstToken,
  body: { role: 'admin' },
  expected: 403,
});

const avatarForm = new FormData();
avatarForm.append('avatar', new Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'smoke.png');
const avatar = await request('/users/avatar', {
  method: 'PATCH',
  token: firstToken,
  formData: avatarForm,
});
assert(avatar.data.avatar?.startsWith('/uploads/avatars/'), 'Avatar upload failed');

const categories = await request('/categories');
assert(categories.data.length >= 2, 'Expected seeded categories');
const categoryIds = categories.data.slice(0, 2).map((category) => Number(category.id));

const post = await request('/posts', {
  method: 'POST',
  token: firstToken,
  expected: 201,
  body: {
    title: `Smoke question ${stamp}`,
    content: 'Smoke test post body with enough information for API verification.',
    categories: categoryIds,
  },
});
const postId = post.data.id;
assert(post.data.categories.length === 2, 'Post categories were not attached');

const editedPost = await request(`/posts/${postId}`, {
  method: 'PATCH',
  token: firstToken,
  body: {
    title: `Updated smoke question ${stamp}`,
    content: 'Updated smoke body.',
    categories: [categoryIds[0]],
  },
});
assert(editedPost.data.title.startsWith('Updated'), 'Owner post update failed');
assert(editedPost.data.categories.length === 1, 'Owner category update failed');

const rootComment = await request(`/posts/${postId}/comments`, {
  method: 'POST',
  token: firstToken,
  expected: 201,
  body: { content: 'Root smoke comment' },
});
const replyComment = await request(`/posts/${postId}/comments`, {
  method: 'POST',
  token: firstToken,
  expected: 201,
  body: { content: 'Nested smoke reply', parentCommentId: rootComment.data.id },
});
assert(Number(replyComment.data.parent_comment_id) === Number(rootComment.data.id), 'Nested comment relation failed');

const seededUser = await request('/auth/login', {
  method: 'POST',
  body: { login: 'asya', email: 'asya@usof.local', password: 'Password123!' },
});
await request(`/posts/${postId}`, {
  method: 'PATCH',
  token: seededUser.token,
  body: { title: 'Forbidden edit', content: 'Forbidden', categories: [categoryIds[0]] },
  expected: 403,
});

await request(`/posts/${postId}/like`, {
  method: 'POST',
  token: seededUser.token,
  body: { type: 'like' },
});
let postReactions = await request(`/posts/${postId}/like`);
assert(postReactions.data.length === 1 && postReactions.data[0].type === 'like', 'Post like was not saved');
await request(`/posts/${postId}/like`, {
  method: 'POST',
  token: seededUser.token,
  body: { type: 'dislike' },
});
postReactions = await request(`/posts/${postId}/like`);
assert(postReactions.data.length === 1 && postReactions.data[0].type === 'dislike', 'Post reaction must update instead of duplicate');

await request(`/comments/${rootComment.data.id}/like`, {
  method: 'POST',
  token: seededUser.token,
  body: { type: 'like' },
});
let commentReactions = await request(`/comments/${rootComment.data.id}/like`);
assert(commentReactions.data.length === 1, 'Comment reaction missing');
await request(`/comments/${rootComment.data.id}/like`, {
  method: 'POST',
  token: seededUser.token,
  body: { type: 'dislike' },
});
commentReactions = await request(`/comments/${rootComment.data.id}/like`);
assert(commentReactions.data.length === 1 && commentReactions.data[0].type === 'dislike', 'Comment reaction uniqueness failed');

const ownerAfterReaction = await request(`/users/${registration.user.id}`, { token: firstToken });
assert(Number(ownerAfterReaction.data.rating) === -2, `Expected rating -2 after two dislikes, got ${ownerAfterReaction.data.rating}`);

const admin = await request('/auth/login', {
  method: 'POST',
  body: { login: 'admin', email: 'admin@usof.local', password: 'Password123!' },
});
const users = await request('/users', { token: admin.token });
assert(users.data.some((user) => user.login === login), 'Admin user listing failed');
const allComments = await request('/comments', { token: admin.token });
assert(allComments.data.some((comment) => Number(comment.id) === Number(rootComment.data.id)), 'Admin comment listing failed');

await request(`/posts/${postId}`, {
  method: 'PATCH',
  token: admin.token,
  body: { status: 'inactive', locked: true },
});
await request(`/posts/${postId}`, { expected: 404 });
await request(`/posts/${postId}`, { token: firstToken });
await request(`/posts/${postId}/comments`, {
  method: 'POST',
  token: firstToken,
  body: { content: 'Must be blocked while inactive and locked' },
  expected: 404,
});
await request(`/posts/${postId}/like`, {
  method: 'POST',
  token: seededUser.token,
  body: { type: 'like' },
  expected: 404,
});
await request(`/posts/${postId}`, {
  method: 'PATCH',
  token: admin.token,
  body: { status: 'active', locked: false },
});

await request(`/comments/${rootComment.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { locked: true },
});
await request(`/posts/${postId}/comments`, {
  method: 'POST',
  token: firstToken,
  body: { content: 'Reply must be blocked', parentCommentId: rootComment.data.id },
  expected: 423,
});
await request(`/comments/${rootComment.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { locked: false },
});

await request('/categories', {
  method: 'POST',
  token: firstToken,
  body: { title: `Nope ${stamp}` },
  expected: 403,
});
const createdCategory = await request('/categories', {
  method: 'POST',
  token: admin.token,
  expected: 201,
  body: { title: `Smoke category ${stamp}`, description: 'Temporary smoke category' },
});
await request(`/categories/${createdCategory.data.id}`, {
  method: 'PATCH',
  token: admin.token,
  body: { description: 'Updated smoke category' },
});
await request(`/categories/${createdCategory.data.id}`, {
  method: 'DELETE',
  token: admin.token,
  expected: 204,
});

await request(`/posts/${postId}/like`, {
  method: 'DELETE',
  token: seededUser.token,
  expected: 204,
});
await request(`/comments/${rootComment.data.id}/like`, {
  method: 'DELETE',
  token: seededUser.token,
  expected: 204,
});
const ownerAfterDelete = await request(`/users/${registration.user.id}`, { token: firstToken });
assert(Number(ownerAfterDelete.data.rating) === 0, `Expected rating 0 after reaction cleanup, got ${ownerAfterDelete.data.rating}`);

await request(`/posts/${postId}`, { method: 'DELETE', token: firstToken, expected: 204 });
await request(`/posts/${postId}`, { expected: 404 });

await request('/auth/logout', { method: 'POST', token: firstToken, expected: 204 });
await request(`/users/${registration.user.id}`, { token: firstToken, expected: 401 });

session = await request('/auth/login', {
  method: 'POST',
  body: { login, email, password },
});
const reset = await request('/auth/password-reset', {
  method: 'POST',
  body: { email },
});
assert(reset.resetToken, 'Development reset token missing');
await request(`/auth/password-reset/${reset.resetToken}`, {
  method: 'POST',
  body: { newPassword },
});
await request(`/users/${registration.user.id}`, { token: session.token, expected: 401 });
await request('/auth/login', {
  method: 'POST',
  expected: 401,
  body: { login, email, password },
});
const finalSession = await request('/auth/login', {
  method: 'POST',
  body: { login, email, password: newPassword },
});
await request(`/users/${registration.user.id}`, { method: 'DELETE', token: finalSession.token, expected: 204 });
await request(`/users/${registration.user.id}`, { token: finalSession.token, expected: 401 });

console.log('Authenticated CRUD, moderation, nested comments, reactions, rating and auth smoke tests passed.');
