import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../API/src/config/db.js';
import { confirmPasswordReset } from '../API/src/controllers/authController.js';

// Run against an initialized test database; each test owns and removes its user.
if (process.env.NODE_ENV !== 'test' || !process.env.DB_NAME?.endsWith('_test') && !process.env.DB_NAME?.endsWith('_ci')) {
  throw new Error('Use NODE_ENV=test and a DB_NAME ending in _test or _ci');
}
after(() => pool.end());
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const password = 'Updated-password-123!';

async function fixture(t) {
  const token = crypto.randomBytes(32).toString('hex');
  const login = `reset_${crypto.randomBytes(8).toString('hex')}`;
  const [result] = await pool.execute(
    `INSERT INTO users(login,email,password_hash,email_verified,reset_token_hash,reset_token_expires)
     VALUES(?,?,?,1,?,DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
    [login, `${login}@example.com`, await bcrypt.hash('Original-password-123!', 4), digest(token)],
  );
  t.after(() => pool.execute('DELETE FROM users WHERE id=?', [result.insertId]));
  return { id: result.insertId, token };
}

function reset(token) {
  return confirmPasswordReset(
    { body: { newPassword: password }, params: { confirm_token: token } },
    { json: (body) => body },
  );
}

// Pause after the initial token lookup to reproduce changes during hashing reliably.
function pauseHashing(t, count = 1) {
  const original = bcrypt.hash;
  let entered = 0;
  let ready;
  let release;
  const reached = new Promise((resolve) => { ready = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  t.mock.method(bcrypt, 'hash', async (...args) => {
    if (++entered === count) ready();
    await gate;
    return original(...args);
  });
  t.after(release);
  return { reached, release };
}

test('only one concurrent reset succeeds and increments session version once', async (t) => {
  const { id, token } = await fixture(t);
  const pause = pauseHashing(t, 2);
  const results = Promise.allSettled([reset(token), reset(token)]);
  await pause.reached;
  pause.release();
  const outcomes = await results;
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((result) => result.status === 'rejected').reason.code, 'INVALID_RESET_TOKEN');
  const [[user]] = await pool.execute('SELECT * FROM users WHERE id=?', [id]);
  assert.equal(user.token_version, 1);
  assert.equal(user.reset_token_hash, null);
  assert.equal(user.reset_token_expires, null);
  assert.ok(await bcrypt.compare(password, user.password_hash));
  await assert.rejects(reset(token), { code: 'INVALID_RESET_TOKEN' });
});

for (const change of ['expired', 'replaced']) {
  test(`token ${change} during hashing cannot change the password`, async (t) => {
    const { id, token } = await fixture(t);
    const [[before]] = await pool.execute('SELECT * FROM users WHERE id=?', [id]);
    const pause = pauseHashing(t);
    const rejected = assert.rejects(reset(token), { code: 'INVALID_RESET_TOKEN' });
    await pause.reached;
    const replacement = digest('replacement-token');
    if (change === 'expired') {
      await pool.execute('UPDATE users SET reset_token_expires=DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id=?', [id]);
    } else {
      await pool.execute('UPDATE users SET reset_token_hash=? WHERE id=?', [replacement, id]);
    }
    pause.release();
    await rejected;
    const [[after]] = await pool.execute('SELECT * FROM users WHERE id=?', [id]);
    assert.equal(after.password_hash, before.password_hash);
    assert.equal(after.token_version, before.token_version);
    assert.equal(after.reset_token_hash, change === 'replaced' ? replacement : before.reset_token_hash);
  });
}
