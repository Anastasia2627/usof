import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const frontend = process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:5173';
const backend = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';

async function loginApi() {
  const response = await fetch(backend + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', password: 'Password123!' }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(frontend + '/#/', { waitUntil: 'networkidle' });
  assert.ok(await page.locator('.threadCard').count() > 0, 'Feed should load actual database posts');
  const firstPost = page.locator('.threadCard').first();
  const firstAuthor = firstPost.locator('.authorLink');
  await firstAuthor.click();
  await page.waitForURL(/#\/profile\/\d+$/);
  assert.ok(await page.getByText('Log in to view profiles.').count(), 'Guest cannot read private profile API');

  await page.goto(frontend + '/#/login', { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('Password123!');
  await page.locator('button.authSubmit').click();
  await page.waitForURL(/#\/$/);
  const identity = page.getByRole('button', { name: 'Profile of admin (admin)' });
  await identity.waitFor();
  assert.ok(await identity.isVisible(), 'Role and identity should be visible on mobile');
  assert.ok(await page.locator('.accountIdentity .accountRole').isVisible(), 'Role text should not be hidden');
  const logout = page.locator('.headerLogout');
  assert.ok(await logout.isVisible(), 'Logout must be visible at 390px viewport');
  await logout.click();
  await page.waitForURL(/#\/$/);
  assert.equal(await page.locator('.headerLogout').count(), 0, 'Logout should clear the session');

  const adminToken = await loginApi();
  const categoryResponse = await fetch(backend + '/categories');
  const category = (await categoryResponse.json()).data[0];
  for (let i = 0; i < 24; i += 1) {
    const response = await fetch(backend + '/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken },
      body: JSON.stringify({
        title: 'Admin paging check ' + i,
        content: 'This temporary CI post checks full list access.',
        categories: [category.id],
      }),
    });
    assert.equal(response.status, 201, 'Cannot create test post ' + i);
  }

  await page.goto(frontend + '/#/login', { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('Password123!');
  await page.locator('button.authSubmit').click();
  await page.waitForURL(/#\/$/);
  await page.goto(frontend + '/#/admin', { waitUntil: 'networkidle' });
  await page.locator('.tabs button').filter({ hasText: /^posts$/ }).click();
  await page.getByText(/Page 1 of 2/).waitFor();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText(/Page 2 of 2/).waitFor();
  assert.ok(await page.locator('.adminRow').count() > 0, 'Second page should show posts');
  console.log('Browser UI checks passed: real feed, profile navigation, mobile role/logout, and admin pagination.');
} finally {
  await browser.close();
}
