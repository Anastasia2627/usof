import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { after, test } from 'node:test';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { pool } from '../API/src/config/db.js';
import { replaceAvatar } from '../API/src/services/avatarService.js';

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use NODE_ENV=test and a DB_NAME ending in _test or _ci');
}

after(() => pool.end());

test('avatar validation trusts decoded image content rather than the declared MIME type', async (t) => {
  const suffix = crypto.randomBytes(6).toString('hex');
  const [created] = await pool.execute(
    `INSERT INTO users(login,email,password_hash,email_verified,role)
     VALUES(?,?,?,1,'user')`,
    [`avatar_${suffix}`, `avatar_${suffix}@example.com`, await bcrypt.hash('Password123!', 4)],
  );
  const userId = Number(created.insertId);
  let savedPath = null;

  t.after(async () => {
    await pool.execute('DELETE FROM users WHERE id=?', [userId]);
    if (savedPath) await fs.unlink(savedPath).catch(() => {});
  });

  await assert.rejects(
    replaceAvatar(userId, {
      buffer: Buffer.from('this is not an image'),
      mimetype: 'image/png',
    }),
    { code: 'INVALID_FILE' },
  );

  const png = await sharp({
    create: {
      width: 40,
      height: 24,
      channels: 3,
      background: { r: 120, g: 80, b: 200 },
    },
  }).png().toBuffer();

  const user = await replaceAvatar(userId, {
    buffer: png,
    mimetype: 'application/octet-stream',
  });

  assert.match(user.avatar, /^\/uploads\/avatars\/[a-f0-9-]+\.webp$|^\/uploads\/avatars\/\d+-[a-f0-9]+\.webp$/);
  savedPath = path.resolve('API', user.avatar.replace(/^\//, ''));
  const metadata = await sharp(await fs.readFile(savedPath)).metadata();
  assert.equal(metadata.format, 'webp');
  assert.ok(metadata.width <= 512 && metadata.height <= 512);
});
