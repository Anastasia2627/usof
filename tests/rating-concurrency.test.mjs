import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { pool } from '../API/src/config/db.js';
import { deleteReaction, setReaction } from '../API/src/services/reactionService.js';

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use NODE_ENV=test and a DB_NAME ending in _test or _ci');
}

after(() => pool.end());

async function createUser(prefix) {
  const suffix = crypto.randomBytes(6).toString('hex');
  const [result] = await pool.execute(
    `INSERT INTO users(login,email,password_hash,email_verified,role)
     VALUES(?,?,?,1,'user')`,
    [`${prefix}_${suffix}`, `${prefix}_${suffix}@example.com`, await bcrypt.hash('Password123!', 4)],
  );
  return Number(result.insertId);
}

test('reactions on different targets cannot overwrite each other in the author rating', async (t) => {
  const authorId = await createUser('rating_author');
  const firstUserId = await createUser('rating_one');
  const secondUserId = await createUser('rating_two');

  t.after(async () => {
    await pool.execute('DELETE FROM users WHERE id IN (?,?,?)', [authorId, firstUserId, secondUserId]);
  });

  const [firstPost] = await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,? ,?,'active',0)",
    [authorId, 'Concurrent rating one', 'First target for a concurrency test'],
  );
  const [secondPost] = await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,? ,?,'active',0)",
    [authorId, 'Concurrent rating two', 'Second target for a concurrency test'],
  );

  await Promise.all([
    setReaction({ userId: firstUserId, postId: Number(firstPost.insertId), type: 'like' }),
    setReaction({ userId: secondUserId, postId: Number(secondPost.insertId), type: 'useful' }),
  ]);

  let [[author]] = await pool.execute('SELECT rating FROM users WHERE id=?', [authorId]);
  assert.equal(Number(author.rating), 3);

  await Promise.all([
    setReaction({ userId: firstUserId, postId: Number(firstPost.insertId), type: 'dislike' }),
    setReaction({ userId: secondUserId, postId: Number(secondPost.insertId), type: 'fire' }),
  ]);

  [[author]] = await pool.execute('SELECT rating FROM users WHERE id=?', [authorId]);
  assert.equal(Number(author.rating), 0);

  await Promise.all([
    deleteReaction({ userId: firstUserId, postId: Number(firstPost.insertId) }),
    deleteReaction({ userId: secondUserId, postId: Number(secondPost.insertId) }),
  ]);

  [[author]] = await pool.execute('SELECT rating FROM users WHERE id=?', [authorId]);
  assert.equal(Number(author.rating), 0);
});
