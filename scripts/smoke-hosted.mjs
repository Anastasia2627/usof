import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = (process.env.HOSTED_PREVIEW_ORIGIN || 'http://127.0.0.1:5001').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  const apiRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) apiRequests.push(request.url());
  });

  await page.goto(`${origin}/#/`);
  await page.locator('.postCard').first().waitFor();
  assert.ok(
    apiRequests.some((url) => url.startsWith(`${origin}/api/posts`)),
    'Hosted frontend must load posts from the same-origin API',
  );
  await page.locator('.postCard').first().click();
  await page.locator('.questionCard h1').waitFor();
  console.log('PASS: built React UI and MySQL-backed API work from the same production origin');
} finally {
  await browser.close();
}
