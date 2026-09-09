const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';

async function get(path, expected = 200) {
  const response = await fetch(`${base}${path}`);
  const data = await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(`GET ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await get('/health');
assert(health.status === 'ok', 'Health endpoint is not healthy');

const categories = await get('/categories');
assert(Array.isArray(categories.data) && categories.data.length >= 5, 'Expected at least five seeded categories');

const firstCategory = await get(`/categories/${categories.data[0].id}`);
assert(firstCategory.data.title === categories.data[0].title, 'Category detail endpoint failed');
const categoryPosts = await get(`/categories/${categories.data[0].id}/posts`);
assert(Array.isArray(categoryPosts.data), 'Category posts endpoint failed');

const posts = await get('/posts?sort=likes&order=desc&page=1&limit=5');
assert(Array.isArray(posts.data), 'Post list has no data array');
assert(posts.pagination?.limit === 5, 'Pagination metadata is invalid');
assert(posts.data.every((post) => Array.isArray(post.categories)), 'Post previews must include category arrays');

const byCategory = await get(`/posts?category=${categories.data[0].id}&sort=date`);
assert(Array.isArray(byCategory.data), 'Category filtering failed');

const activePost = posts.data[0];
assert(activePost?.id, 'Expected at least one public seeded post');
const post = await get(`/posts/${activePost.id}`);
assert(Number(post.data.id) === Number(activePost.id), 'Post detail endpoint failed');
const postCategories = await get(`/posts/${activePost.id}/categories`);
assert(Array.isArray(postCategories.data), 'Post categories endpoint failed');
const postReactions = await get(`/posts/${activePost.id}/like`);
assert(Array.isArray(postReactions.data), 'Post reactions endpoint failed');
const comments = await get(`/posts/${activePost.id}/comments`);
assert(Array.isArray(comments.data), 'Post comments endpoint failed');

if (comments.data[0]) {
  const commentId = comments.data[0].id;
  const comment = await get(`/comments/${commentId}`);
  assert(Number(comment.data.id) === Number(commentId), 'Comment detail endpoint failed');
  const commentReactions = await get(`/comments/${commentId}/like`);
  assert(Array.isArray(commentReactions.data), 'Comment reactions endpoint failed');
}

console.log('Public API route, filtering and pagination smoke tests passed.');
