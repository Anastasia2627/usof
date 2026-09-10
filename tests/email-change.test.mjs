import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../API/src/config/db.js';
import { updateUser } from '../API/src/controllers/usersController.js';
import { login, verifyEmail, confirmPasswordReset, requestPasswordReset } from '../API/src/controllers/authController.js';
import { requireAuth, signAuthToken } from '../API/src/middleware/auth.js';

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use NODE_ENV=test and a DB_NAME ending in _test or _ci');
}
// These tests exercise token delivery through the development response only.
process.env.MAIL_HOST = '';
after(() => pool.end());
const password = 'Original-password-123!';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const response = { json: (value) => value };
async function invoke(handler, req) {
  let body;
  await handler(req, { json: (value) => { body = value; } });
  return body;
}
async function fixture(t) {
  const suffix = crypto.randomBytes(8).toString('hex');
  const login = `email_${suffix}`;
  const token = `reset_${suffix}`;
  const verification = `verify_${suffix}`;
  const [result] = await pool.execute(
    `INSERT INTO users(login,email,password_hash,email_verified,reset_token_hash,reset_token_expires,verification_token,verification_token_expires)
     VALUES(?,?,?,1,?,DATE_ADD(NOW(), INTERVAL 30 MINUTE),?,DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
    [login, `${login}@example.com`, await bcrypt.hash(password, 4), digest(token), verification],
  );
  t.after(() => pool.execute('DELETE FROM users WHERE id=?', [result.insertId]));
  return { ...await read(result.insertId), token, verification };
}
async function read(id) {
  const [[user]] = await pool.execute('SELECT * FROM users WHERE id=?', [id]);
  return user;
}
const update = (id, body, role = 'admin') => invoke(updateUser, { params: { user_id: id }, body, user: { sub: id, role } });
const authenticate = (token) => new Promise((resolve, reject) => {
  requireAuth({ headers: { authorization: `Bearer ${token}` } }, {}, (error) => error ? reject(error) : resolve());
});

test('email change revokes old credentials and requires confirmation of the new address', async (t) => {
  const user = await fixture(t);
  const session = signAuthToken(user);
  const email = `new_${user.email}`;
  const changed = await update(user.id, { email });
  assert.equal(changed.sessionInvalidated, true);
  assert.equal(changed.data.email_verified, 0);
  assert.ok(changed.verificationToken);
  assert.equal(changed.emailDelivery, 'not-configured');
  await assert.rejects(authenticate(session), { code: 'INVALID_TOKEN' });
  await assert.rejects(confirmPasswordReset({ params: { confirm_token: user.token }, body: { newPassword: password } }, response), { code: 'INVALID_RESET_TOKEN' });
  await assert.rejects(verifyEmail({ params: { token: user.verification } }, response), { code: 'INVALID_TOKEN' });
  await assert.rejects(login({ body: { login: user.login, password } }, response), { code: 'EMAIL_NOT_VERIFIED' });
  const retry = await update(user.id, { email });
  assert.ok(retry.verificationToken && retry.verificationToken !== changed.verificationToken);
  await assert.rejects(verifyEmail({ params: { token: changed.verificationToken } }, response), { code: 'INVALID_TOKEN' });
  await verifyEmail({ params: { token: retry.verificationToken } }, response);
  const signedIn = await invoke(login, { body: { email, password } });
  await authenticate(signedIn.token);
  const saved = await read(user.id);
  assert.equal(saved.token_version, user.token_version + 1);
  assert.equal(saved.reset_token_hash, null);
  assert.equal(saved.reset_token_expires, null);
});

test('normalized unchanged email and profile edits preserve verification and sessions', async (t) => {
  const user = await fixture(t);
  const result = await update(user.id, { email: ` ${user.email.toUpperCase()} `, fullName: 'Updated Name' });
  assert.equal(result.sessionInvalidated, false);
  assert.equal(result.verificationToken, undefined);
  const saved = await read(user.id);
  assert.equal(saved.email_verified, 1);
  assert.equal(saved.token_version, user.token_version);
  assert.equal(saved.reset_token_hash, user.reset_token_hash);
  await authenticate(signAuthToken(user));
});

test('duplicate email rolls back the entire update; regular users cannot change email', async (t) => {
  const user = await fixture(t);
  const other = await fixture(t);
  await assert.rejects(update(user.id, { email: other.email, fullName: 'Must roll back' }), { code: 'USER_EXISTS' });
  await assert.rejects(update(user.id, { email: `new_${user.email}` }, 'user'), { code: 'FIELD_FORBIDDEN' });
  const saved = await read(user.id);
  for (const key of ['email', 'full_name', 'email_verified', 'token_version', 'reset_token_hash', 'verification_token']) {
    assert.equal(saved[key], user[key]);
  }
});

test('reset request started before email change cannot install a token for the old address', async (t) => {
  const user = await fixture(t);
  const original = pool.execute.bind(pool);
  t.mock.method(pool, 'execute', async (sql, args) => {
    const result = await original(sql, args);
    if (sql === 'SELECT id, login FROM users WHERE email=?') {
      await update(user.id, { email: `new_${user.email}` });
    }
    return result;
  });
  const result = await invoke(requestPasswordReset, { body: { email: user.email } });
  assert.equal(result.resetToken, undefined);
  assert.equal((await read(user.id)).reset_token_hash, null);
});
