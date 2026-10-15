// Integration check against a disposable MySQL-backed API.
// Requires NODE_ENV=test and a DB_NAME ending with _test or _ci.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if (process.env.NODE_ENV !== 'test' || !/(_test|_ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Verification smoke requires a disposable *_test or *_ci database.');
}

const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
const suffix = crypto.randomBytes(5).toString('hex');
const login = 'verify_' + suffix;
const email = login + '@example.test';
const password = 'Password123!';

async function request(path, { method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, expected,
    path + ' expected ' + expected + ' got ' + response.status + ': ' + JSON.stringify(data));
  return data;
}

const register = await request('/auth/register', {
  method: 'POST', expected: 201,
  body: { login, email, fullName: 'Test Member', password, passwordConfirmation: password },
});
assert.equal(register.user.role, 'user');
assert.equal(register.user.email_verified, 0);
assert.match(register.verificationCode, /^\d{6}$/);
assert.ok(register.verificationToken);

await request('/auth/login', { method: 'POST', body: { login, password }, expected: 403 });

const sentAgain = await request('/auth/resend-verification', {
  method: 'POST', body: { email },
});
assert.match(sentAgain.verificationCode, /^\d{6}$/);
assert.notEqual(sentAgain.verificationCode, register.verificationCode);
assert.notEqual(sentAgain.verificationToken, register.verificationToken);

await request('/auth/verify-email-code', {
  method: 'POST', body: { email, code: register.verificationCode }, expected: 400,
});
await request('/auth/verify-email/' + register.verificationToken, {
  method: 'POST', expected: 400,
});
await request('/auth/resend-verification', {
  method: 'POST', body: { email }, expected: 429,
});

const verified = await request('/auth/verify-email-code', {
  method: 'POST', body: { email, code: sentAgain.verificationCode },
});
assert.equal(verified.message, 'Email verified');
await request('/auth/verify-email-code', {
  method: 'POST', body: { email, code: sentAgain.verificationCode }, expected: 400,
});
const session = await request('/auth/login', {
  method: 'POST', body: { email, password },
});
assert.equal(session.user.email_verified, 1);
assert.ok(session.token);

console.log('Real database registration, resend, cooldown, single-use code and login passed.');
