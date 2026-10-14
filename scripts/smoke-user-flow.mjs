import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
const webBase = process.env.WEB_BASE_URL || 'http://localhost:5173';

async function request(path, { method = 'GET', token, body, expected = 200 } = {}) {
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

const login = `ui${Date.now().toString(36)}`;
const email = `${login}@example.com`;
const password = 'TestBrowser123!';
const title = 'Browser journey: create question';
const updatedTitle = 'Browser journey: edited question';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const user = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  user.setDefaultTimeout(20000);
  await user.goto(`${webBase}/#/`);
  await user.getByRole('heading', { name: /Ask clearly/ }).waitFor();

  await user.goto(`${webBase}/#/register`);
  await user.getByLabel('Login', { exact: true }).fill(login);
  await user.getByLabel('Full name').fill('Browser Test User');
  await user.getByLabel('Email', { exact: true }).fill(email);
  await user.getByLabel('Password', { exact: true }).fill(password);
  await user.getByLabel('Confirm password').fill(password);
  await user.locator('form.card.form').getByRole('button', { name: 'Create account' }).click();
  await user.getByRole('heading', { name: 'Verify your email' }).waitFor();
  await user.getByRole('button', { name: 'Verify this account' }).click();
  await user.getByText('Email verified', { exact: true }).waitFor();
  await user.getByRole('button', { name: 'Continue to login' }).click();

  await user.getByLabel('Login or email').fill(login);
  await user.getByLabel('Password', { exact: true }).fill(password);
  await user.locator('form.card.form').getByRole('button', { name: 'Log in' }).click();
  await user.waitForURL('**/#/');
  console.log('PASS: registration, verification and login complete in browser');

  const session = await user.evaluate(() => JSON.parse(localStorage.getItem('usof-auth') || 'null'));
  assert.ok(session?.token, 'Authenticated UI must have a session');
  await request('/users', { token: session.token, expected: 403 });

  await user.goto(`${webBase}/#/create`);
  await user.getByLabel('Title').fill(title);
  await user.getByLabel('Details').fill('A full browser test question with enough detail to verify the editor.');
  await user.locator('.checkGrid input[type="checkbox"]').first().check();
  await user.getByRole('button', { name: 'Publish question' }).click();
  await user.waitForURL(/#\/post\/\d+$/);
  await user.getByRole('heading', { name: title }).waitFor();
  const postId = Number(user.url().split('/post/')[1]);
  assert.ok(postId > 0);

  await user.getByRole('button', { name: 'Edit question' }).click();
  await user.getByRole('heading', { name: 'Edit question' }).waitFor();
  await user.getByLabel('Title').fill(updatedTitle);
  await user.getByRole('button', { name: 'Save changes' }).click();
  await user.getByRole('heading', { name: updatedTitle }).waitFor();
  const updated = await request(`/posts/${postId}`, { token: session.token });
  assert.equal(updated.data.title, updatedTitle);
  console.log('PASS: user creates and edits their own post');

  await user.goto(`${webBase}/#/profile`);
  await user.getByLabel('Full name').fill('Updated Browser Test User');
  await user.getByRole('button', { name: 'Save profile' }).click();
  await user.getByText('Profile saved.').waitFor();
  const updatedProfile = await request(`/users/${session.user.id}`, { token: session.token });
  assert.equal(updatedProfile.data.full_name, 'Updated Browser Test User');
  console.log('PASS: user can update their own profile');

  await user.goto(`${webBase}/#/admin`);
  await user.getByText('Admin access required.').waitFor();
  console.log('PASS: regular user cannot access admin console');

  const other = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  other.setDefaultTimeout(20000);
  await other.goto(`${webBase}/#/login`);
  await other.getByLabel('Login or email').fill('alex');
  await other.getByLabel('Password', { exact: true }).fill('Password123!');
  await other.locator('form.card.form').getByRole('button', { name: 'Log in' }).click();
  await other.waitForURL('**/#/');
  await other.goto(`${webBase}/#/edit/${postId}`);
  await other.getByText('Only the author can edit this question.').waitFor();
  assert.equal(await other.getByRole('button', { name: 'Save changes' }).count(), 0);
  const otherSession = await other.evaluate(() => JSON.parse(localStorage.getItem('usof-auth') || 'null'));
  await request(`/posts/${postId}`, {
    method: 'PATCH',
    token: otherSession.token,
    body: { title: 'Unauthorized modification' },
    expected: 403,
  });
  console.log('PASS: another user cannot edit the post in UI or API');
} finally {
  await browser.close();
}
