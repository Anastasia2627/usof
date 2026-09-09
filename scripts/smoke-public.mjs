const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';

async function get(path, expected = 200) {
  const response = await fetch(`${base}${path}`);
  const data = await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(`GET ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const health = await get('/health');
if (health.status !== 'ok') throw new Error('Health endpoint is not healthy');

const categories = await get('/categories');
if (!Array.isArray(categories.data) || categories.data.length < 5) {
  throw new Error('Expected at least five seeded categories');
}

const posts = await get('/posts?sort=likes&order=desc&page=1&limit=5');
if (!Array.isArray(posts.data)) throw new Error('Post list has no data array');
if (!posts.pagination || posts.pagination.limit !== 5) throw new Error('Pagination metadata is invalid');
if (!posts.data.every((post) => Array.isArray(post.categories))) {
  throw new Error('Post previews must include category arrays');
}

const byCategory = await get(`/posts?category=${categories.data[0].id}&sort=date`);
if (!Array.isArray(byCategory.data)) throw new Error('Category filtering failed');

console.log('Public API smoke test passed.');
