import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { pool } from '../API/src/config/db.js';
import { deleteAccount, updateAccount } from '../API/src/services/accountService.js';

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use NODE_ENV=test and a DB_NAME ending in _test or _ci');
}

after(() => pool.end());

test('the final administrator cannot be demoted or deleted', async (t) => {
  const [[seedAdmin]] = await pool.execute("SELECT * FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  assert.ok(seedAdmin, 'Seed administrator is missing');

  const suffix = crypto.randomBytes(6).toString('hex');
  const [created] = await pool.execute(
    `INSERT INTO users(login,email,password_hash,email_verified,role)
     VALUES(?,?,?,1,'admin')`,
    [`guard_${suffix}`, `guard_${suffix}@example.com`, await bcrypt.hash('Password123!', 4)],
  );
  const temporaryAdminId = Number(created.insertId);

  t.after(async () => {
    await pool.execute("UPDATE users SET role='admin' WHERE id=?", [seedAdmin.id]);
    await pool.execute('DELETE FROM users WHERE id=?', [temporaryAdminId]);
  });

  await updateAccount({
    targetId: seedAdmin.id,
    actor: { sub: temporaryAdminId, role: 'admin' },
    body: { role: 'user' },
  });

  await assert.rejects(
    updateAccount({
      targetId: temporaryAdminId,
      actor: { sub: temporaryAdminId, role: 'admin' },
      body: { role: 'user' },
    }),
    { code: 'LAST_ADMIN_REQUIRED' },
  );

  await assert.rejects(
    deleteAccount({
      targetId: temporaryAdminId,
      actor: { sub: temporaryAdminId, role: 'admin' },
    }),
    { code: 'LAST_ADMIN_REQUIRED' },
  );

  const [[stillAdmin]] = await pool.execute('SELECT role FROM users WHERE id=?', [temporaryAdminId]);
  assert.equal(stillAdmin.role, 'admin');
});
