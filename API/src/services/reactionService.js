import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export async function recalculateUserRating(connection, userId) {
  const [[row]] = await connection.query(
    `SELECT COALESCE(SUM(score), 0) AS rating
     FROM (
       SELECT CASE r.type WHEN 'like' THEN 1 ELSE -1 END AS score
       FROM reactions r
       JOIN posts p ON p.id = r.post_id
       WHERE p.author_id = ?
       UNION ALL
       SELECT CASE r.type WHEN 'like' THEN 1 ELSE -1 END AS score
       FROM reactions r
       JOIN comments c ON c.id = r.comment_id
       WHERE c.author_id = ?
     ) scores`,
    [userId, userId],
  );
  await connection.query('UPDATE users SET rating=? WHERE id=?', [Number(row.rating), userId]);
}

export async function recalculateAllRatings(connection = pool) {
  await connection.query(`
    UPDATE users u
    SET rating = (
      SELECT COALESCE(SUM(score), 0)
      FROM (
        SELECT p.author_id AS user_id,
               CASE r.type WHEN 'like' THEN 1 ELSE -1 END AS score
        FROM reactions r
        JOIN posts p ON p.id = r.post_id
        WHERE r.post_id IS NOT NULL
        UNION ALL
        SELECT c.author_id AS user_id,
               CASE r.type WHEN 'like' THEN 1 ELSE -1 END AS score
        FROM reactions r
        JOIN comments c ON c.id = r.comment_id
        WHERE r.comment_id IS NOT NULL
      ) all_scores
      WHERE all_scores.user_id = u.id
    )
  `);
}

async function getTarget(connection, { postId, commentId }) {
  if (!!postId === !!commentId) {
    throw new AppError(422, 'INVALID_TARGET', 'Choose exactly one reaction target');
  }

  if (postId) {
    const [[post]] = await connection.query(
      'SELECT id, author_id, status, locked FROM posts WHERE id=?',
      [postId],
    );
    if (!post) throw new AppError(404, 'TARGET_NOT_FOUND', 'Post not found');
    return { ...post, kind: 'post' };
  }

  const [[comment]] = await connection.query(
    `SELECT c.id, c.author_id, c.status, c.locked,
            p.status AS post_status, p.locked AS post_locked
     FROM comments c
     JOIN posts p ON p.id = c.post_id
     WHERE c.id=?`,
    [commentId],
  );
  if (!comment) throw new AppError(404, 'TARGET_NOT_FOUND', 'Comment not found');
  return { ...comment, kind: 'comment' };
}

function ensureReactable(target, isAdmin) {
  if (isAdmin) return;
  if (target.status !== 'active' || target.post_status === 'inactive') {
    throw new AppError(404, 'TARGET_NOT_AVAILABLE', 'Active reaction target not found');
  }
  if (target.locked || target.post_locked) {
    throw new AppError(423, 'TARGET_LOCKED', 'This discussion is locked');
  }
}

export async function setReaction({
  userId,
  postId = null,
  commentId = null,
  type,
  isAdmin = false,
}) {
  if (!['like', 'dislike'].includes(type)) {
    throw new AppError(422, 'INVALID_REACTION', 'Reaction type must be like or dislike');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await getTarget(connection, { postId, commentId });
    ensureReactable(target, isAdmin);

    const column = postId ? 'post_id' : 'comment_id';
    const targetId = Number(postId || commentId);
    const [existing] = await connection.query(
      `SELECT id, type FROM reactions WHERE author_id=? AND ${column}=? FOR UPDATE`,
      [userId, targetId],
    );

    if (existing[0]) {
      await connection.query(
        'UPDATE reactions SET type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [type, existing[0].id],
      );
    } else {
      await connection.query(
        `INSERT INTO reactions(author_id, ${column}, type) VALUES(?,?,?)`,
        [userId, targetId, type],
      );
    }

    await recalculateUserRating(connection, target.author_id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteReaction({
  userId,
  postId = null,
  commentId = null,
  deleteAll = false,
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await getTarget(connection, { postId, commentId });
    const column = postId ? 'post_id' : 'comment_id';
    const targetId = Number(postId || commentId);

    const [result] = deleteAll
      ? await connection.query(`DELETE FROM reactions WHERE ${column}=?`, [targetId])
      : await connection.query(
        `DELETE FROM reactions WHERE ${column}=? AND author_id=?`,
        [targetId, userId],
      );

    if (!deleteAll && !result.affectedRows) {
      throw new AppError(404, 'REACTION_NOT_FOUND', 'Reaction not found');
    }

    await recalculateUserRating(connection, target.author_id);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
