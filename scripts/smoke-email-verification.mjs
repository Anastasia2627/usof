// Integration check against a disposable MySQL-backed API.
// Requires NODE_ENV=test and a DB_NAME ending with _test or _ci.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

if (process.env.NODE_ENV !== 'test' || !/(_test|_ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Verification smoke requires a disposable *_test or *_ci database.');
}

const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
const suffix = crypto.randomBytes(5).toString('hex');
const login = 'verify_' + suffix;
const email = login + '@example.test';
const password = 'Password123!';

// Optional end-to-end SMTP assertions: the CI server accepts authenticated
// messages and records the exact email contents. This is not a mock API call.
const checkSmtp = process.env.MAIL_TEST_INTEGRATION === 'true';
function capturedEmails() {
  if (!checkSmtp) return [];
  return readFileSync(process.env.MAIL_TEST_SINK_FILE, 'utf8')
    .split('\n').filter(Boolean).map(line => JSON.parse(line));
}
function assertDelivered(token, code, label) {
  if (!checkSmtp) return;
  const messages = capturedEmails();
  const raw = messages.at(-1)?.message || '';
  const unwrapped = raw.replace(/=\n/g, '');
  assert.ok(messages.length > 0, label + ': no email was transferred to SMTP');
  assert.ok(unwrapped.includes(token), label + ': confirmation/reset link missing in SMTP message');
  if (code) assert.ok(unwrapped.includes(code), label + ': confirmation code missing in SMTP message');
  assert.match(raw, /Content-Type:/i, label + ': malformed SMTP message');
}


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
if (checkSmtp) assert.equal(register.emailDelivery, 'sent', 'SMTP must accept registration email');
assertDelivered(register.verificationToken, register.verificationCode, 'registration');


await request('/auth/login', { method: 'POST', body: { login, password }, expected: 403 });

const sentAgain = await request('/auth/resend-verification', {
  method: 'POST', body: { email },
});
assert.match(sentAgain.verificationCode, /^\d{6}$/);
assert.notEqual(sentAgain.verificationCode, register.verificationCode);
assert.notEqual(sentAgain.verificationToken, register.verificationToken);
if (checkSmtp) assert.equal(sentAgain.emailDelivery, 'sent', 'SMTP must accept resend');
assertDelivered(sentAgain.verificationToken, sentAgain.verificationCode, 'resend');


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


const reset = await request('/auth/password-reset', {
  method: 'POST', body: { email },
});
assert.ok(reset.message);
if (checkSmtp) {
  assert.equal(reset.emailDelivery, 'sent', 'SMTP must accept reset email');
  assert.ok(reset.resetToken, 'test-only reset token missing');
  assertDelivered(reset.resetToken, null, 'password reset');
}
// A second request within the cooldown must not overwrite the first reset link
const duplicateReset=await request('/auth/password-reset',{
  method:'POST',body:{email},
});
assert.equal(duplicateReset.resetToken,undefined);

// Complete the recovery workflow rather than only checking message submission
assert.ok(reset.resetToken, 'A disposable test run must expose a reset token');
await request('/auth/password-reset/'+reset.resetToken,{
  method:'POST',body:{newPassword:'Changed-Password-123!'},
});
await request('/auth/password-reset/'+reset.resetToken,{
  method:'POST',body:{newPassword:'Another-Password-123!'},expected:400,
});
await request('/auth/login',{
  method:'POST',body:{email,password},expected:401,
});
const recovered=await request('/auth/login',{
  method:'POST',body:{email,password:'Changed-Password-123!'},
});
assert.ok(recovered.token);

console.log('Real MySQL registration, resend, single-use codes, password-reset email and login passed.');
