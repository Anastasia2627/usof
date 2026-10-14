import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
const webBase = process.env.WEB_BASE_URL || 'http://localhost:5173';

async function apiRequest(path, { method = 'GET', token, body, expected = 200 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = response.status === 204 ? null : await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}

const login = await apiRequest('/auth/login', {
  method: 'POST',
  body: { login: 'admin', email: 'admin@usof.local', password: 'Password123!' },
});
const token = login.token;

const categories = await apiRequest('/categories');
assert.ok(categories.data.length, 'At least one category is required for the browser smoke test');
const categoryId = categories.data[0].id;

// The admin UI must show all posts, not just the API's first 50 results.
const initialFeed = await apiRequest('/posts?limit=1', { token });
const toCreate = Math.max(0, 51 - initialFeed.pagination.total);
for (let i = 0; i < toCreate; i += 1) {
  await apiRequest('/posts', {
    method: 'POST',
    token,
    body: {
      title: `Pagination regression check ${i + 1}`,
      content: 'A test question to verify moderation pagination.',
      categories: [categoryId],
    },
    expected: 201,
  });
}

let postWithComments = null;
for (let id = 1; id <= 20; id += 1) {
  const response = await fetch(`${apiBase}/posts/${id}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    const payload = await response.json();
    if (payload.data?.length) {
      postWithComments = id;
      break;
    }
  }
}
assert.ok(postWithComments, 'Expected an existing discussion with comments in the test database');

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);

  await page.goto(`${webBase}/#/login`);
  await page.getByLabel('Login or email').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('Password123!');
  await page.locator('form.card.form').getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/#/');

  await page.goto(`${webBase}/#/admin`);
  await page.getByRole('button', { name: 'posts', exact: true }).click();
  await page.getByText(/^Page 1 \/ [2-9][0-9]*$/).waitFor();
  assert.equal(await page.locator('.adminStack .adminRow').count(), 50);

  await page.getByRole('button', { name: 'Next →' }).click();
  await page.getByText(/^Page 2 \/ [2-9][0-9]*$/).waitFor();
  assert.ok(await page.locator('.adminStack .adminRow').count() > 0);
  console.log('PASS: admin can moderate posts beyond the first 50');

  await page.goto(`${webBase}/#/post/${postWithComments}`);
  const firstComment = page.locator('.commentCard').first();
  await firstComment.waitFor();
  await firstComment.getByRole('button', { name: 'Reply', exact: true }).click();

  const replyBox = firstComment.locator('.replyForm textarea');
  const draft = 'My response must not disappear if the server is temporarily unavailable.';
  await replyBox.fill(draft);

  const routeMatcher = '**/api/posts/*/comments';
  const failReply = async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'TEST_FAILURE', message: 'Simulated backend failure' } }),
      });
    } else {
      await route.continue();
    }
  };
  await page.route(routeMatcher, failReply);
  await firstComment.locator('.replyForm').getByRole('button', { name: 'Post reply' }).click();
  await firstComment.getByText('Simulated backend failure').waitFor();
  assert.equal(await replyBox.inputValue(), draft);
  assert.ok(await firstComment.locator('.replyForm').isVisible());
  console.log('PASS: failed reply keeps the draft and editor open');

  await page.unroute(routeMatcher, failReply);
  await firstComment.locator('.replyForm').getByRole('button', { name: 'Post reply' }).click();
  await page.locator('.replyForm').waitFor({ state: 'detached' });
  const updatedComments = await apiRequest(`/posts/${postWithComments}/comments`, { token });
  assert.ok(
    updatedComments.data.some((item) => item.content === draft),
    'A retried reply should reach the API successfully',
  );
  console.log('PASS: retry submits the preserved reply');
} finally {
  await browser.close();
}
