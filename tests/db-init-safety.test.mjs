import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { after, test } from 'node:test';
import { pool } from '../API/src/config/db.js';

const run = promisify(execFile);

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use NODE_ENV=test and a DB_NAME ending in _test or _ci');
}

after(() => pool.end());

test('db:init preserves existing data and an unconfirmed reset is refused', async (t) => {
  const title = `Init safety ${crypto.randomBytes(6).toString('hex')}`;
  const [created] = await pool.execute(
    'INSERT INTO categories(title,description) VALUES(?,?)',
    [title, 'This row must survive a normal initialization command.'],
  );
  const categoryId = Number(created.insertId);
  t.after(() => pool.execute('DELETE FROM categories WHERE id=?', [categoryId]));

  const normal = await run(process.execPath, ['API/database/init.js'], {
    cwd: process.cwd(),
    env: process.env,
  });
  assert.match(normal.stdout, /left untouched/i);

  let [[row]] = await pool.execute('SELECT id FROM categories WHERE id=?', [categoryId]);
  assert.equal(Number(row.id), categoryId);

  await assert.rejects(
    run(process.execPath, ['API/database/init.js', '--reset'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'development' },
    }),
    (error) => /Refusing to reset database/.test(`${error.stderr || ''}${error.stdout || ''}`),
  );

  [[row]] = await pool.execute('SELECT id FROM categories WHERE id=?', [categoryId]);
  assert.equal(Number(row.id), categoryId);
});
