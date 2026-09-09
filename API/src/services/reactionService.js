import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

async function recalcRating(connection, authorId) {
  const [[row]] = await connection.query(`
    SELECT COALESCE(SUM(score),0) AS rating FROM (
      SELECT CASE r.type WHEN 'like' THEN 1 ELSE -1 END score
      FROM reactions r JOIN posts p ON r.post_id=p.id WHERE p.author_id=?
      UNION ALL
      SELECT CASE r.type WHEN 'like' THEN 1 ELSE -1 END score
      FROM reactions r JOIN comments c ON r.comment_id=c.id WHERE c.author_id=?
    ) x`, [authorId, authorId]);
  await connection.query('UPDATE users SET rating=? WHERE id=?', [Number(row.rating), authorId]);
}

export async function setReaction({ userId, postId = null, commentId = null, type }) {
  if (!['like', 'dislike'].includes(type)) throw new AppError(422, 'INVALID_REACTION', 'Reaction type must be like or dislike');
  if (!!postId === !!commentId) throw new AppError(422, 'INVALID_TARGET', 'Choose exactly one reaction target');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const table = postId ? 'posts' : 'comments';
    const targetId = postId || commentId;
    const [[target]] = await connection.query(`SELECT author_id FROM ${table} WHERE id=?`, [targetId]);
    if (!target) throw new AppError(404, 'TARGET_NOT_FOUND', 'Reaction target not found');
    const column = postId ? 'post_id' : 'comment_id';
    const [existing] = await connection.query(`SELECT id FROM reactions WHERE author_id=? AND ${column}=?`, [userId, targetId]);
    if (existing[0]) {
      await connection.query('UPDATE reactions SET type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [type, existing[0].id]);
    } else {
      await connection.query(`INSERT INTO reactions(author_id, ${column}, type) VALUES(?,?,?)`, [userId, targetId, type]);
    }
    await recalcRating(connection, target.author_id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteReaction({ userId, postId = null, commentId = null, isAdmin = false }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const table = postId ? 'posts' : 'comments';
    const targetId = postId || commentId;
    const [[target]] = await connection.query(`SELECT author_id FROM ${table} WHERE id=?`, [targetId]);
    if (!target) throw new AppError(404, 'TARGET_NOT_FOUND', 'Reaction target not found');
    const column = postId ? 'post_id' : 'comment_id';
    const sql = isAdmin ? `DELETE FROM reactions WHERE ${column}=?` : `DELETE FROM reactions WHERE ${column}=? AND author_id=?`;
    await connection.query(sql, isAdmin ? [targetId] : [targetId, userId]);
    await recalcRating(connection, target.author_id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
