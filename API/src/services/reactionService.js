import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

const REACTION_WEIGHTS = Object.freeze({
  like: 1,
  dislike: -1,
  useful: 2,
  fire: 1,
  thanks: 1,
});

const RATING_CASE_SQL = `
  CASE r.type
    WHEN 'like' THEN 1
    WHEN 'dislike' THEN -1
    WHEN 'useful' THEN 2
    WHEN 'fire' THEN 1
    WHEN 'thanks' THEN 1
    ELSE 0
  END
`;

export const reactionTypes = Object.freeze(Object.keys(REACTION_WEIGHTS));

export function reactionWeight(type) {
  return Number(REACTION_WEIGHTS[type] || 0);
}

async function adjustUserRating(connection, userId, delta) {
  if (!delta) return;
  await connection.query('UPDATE users SET rating=rating+? WHERE id=?', [delta, userId]);
}

export async function recalculateUserRating(connection, userId) {
  const [locked] = await connection.query('SELECT id FROM users WHERE id=? FOR UPDATE', [userId]);
  if (!locked[0]) return;
  const [[row]] = await connection.query(
    `SELECT COALESCE(SUM(score), 0) AS rating
     FROM (
       SELECT ${RATING_CASE_SQL} AS score
       FROM reactions r
       JOIN posts p ON p.id = r.post_id
       WHERE p.author_id = ?
       UNION ALL
       SELECT ${RATING_CASE_SQL} AS score
       FROM reactions r
       JOIN comments c ON c.id = r.comment_id
       WHERE c.author_id = ?
     ) scores`,
    [userId, userId],
  );
  await connection.query('UPDATE users SET rating=? WHERE id=?', [Number(row.rating), userId]);
}

export async function recalculateAllRatings(connection = pool) {
  await connection.query('SELECT id FROM users ORDER BY id FOR UPDATE');
  await connection.query(`
    UPDATE users u
    SET rating = (
      SELECT COALESCE(SUM(score), 0)
      FROM (
        SELECT p.author_id AS user_id, ${RATING_CASE_SQL} AS score
        FROM reactions r
        JOIN posts p ON p.id = r.post_id
        WHERE r.post_id IS NOT NULL
        UNION ALL
        SELECT c.author_id AS user_id, ${RATING_CASE_SQL} AS score
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
      'SELECT id, author_id, status, locked FROM posts WHERE id=? FOR UPDATE',
      [postId],
    );
    if (!post) throw new AppError(404, 'TARGET_NOT_FOUND', 'Post not found');
    return { ...post, kind: 'post' };
  }
  const [[comment]] = await connection.query(
    `SELECT c.id, c.author_id, c.status, c.locked, c.post_id,
            p.status AS post_status, p.locked AS post_locked
     FROM comments c
     JOIN posts p ON p.id = c.post_id
     WHERE c.id=?
     FOR UPDATE`,
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

export async function setReaction({ userId, postId = null, commentId = null, type, isAdmin = false }) {
  if (!reactionTypes.includes(type)) {
    throw new AppError(422, 'INVALID_REACTION', `Reaction type must be one of: ${reactionTypes.join(', ')}`);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await getTarget(connection, { postId, commentId });
    if (Number(target.author_id) === Number(userId)) {
      throw new AppError(409, 'SELF_REACTION_NOT_ALLOWED', 'You cannot react to your own contribution');
    }
    ensureReactable(target, isAdmin);

    const column = postId ? 'post_id' : 'comment_id';
    const targetId = Number(postId || commentId);
    const [existing] = await connection.query(
      `SELECT id, type FROM reactions WHERE author_id=? AND ${column}=? FOR UPDATE`,
      [userId, targetId],
    );
    const previousType = existing[0]?.type || null;
    const changed = previousType !== type;

    if (existing[0] && changed) {
      await connection.query(
        'UPDATE reactions SET type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [type, existing[0].id],
      );
    } else if (!existing[0]) {
      await connection.query(
        `INSERT INTO reactions(author_id, ${column}, type) VALUES(?,?,?)`,
        [userId, targetId, type],
      );
    }

    if (changed) {
      await adjustUserRating(
        connection,
        target.author_id,
        reactionWeight(type) - reactionWeight(previousType),
      );
    }
    await connection.commit();

    return {
      targetAuthorId: Number(target.author_id),
      postId: target.kind === 'post' ? Number(target.id) : Number(target.post_id),
      commentId: target.kind === 'comment' ? Number(target.id) : null,
      type,
      previousType,
      changed,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteReaction({ userId, postId = null, commentId = null, deleteAll = false }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const target = await getTarget(connection, { postId, commentId });
    const column = postId ? 'post_id' : 'comment_id';
    const targetId = Number(postId || commentId);

    const [rows] = deleteAll
      ? await connection.query(`SELECT id, type FROM reactions WHERE ${column}=? FOR UPDATE`, [targetId])
      : await connection.query(
        `SELECT id, type FROM reactions WHERE ${column}=? AND author_id=? FOR UPDATE`,
        [targetId, userId],
      );

    if (!deleteAll && !rows[0]) {
      throw new AppError(404, 'REACTION_NOT_FOUND', 'Reaction not found');
    }

    if (deleteAll) {
      await connection.query(`DELETE FROM reactions WHERE ${column}=?`, [targetId]);
    } else {
      await connection.query('DELETE FROM reactions WHERE id=?', [rows[0].id]);
    }

    const removedWeight = rows.reduce((sum, row) => sum + reactionWeight(row.type), 0);
    await adjustUserRating(connection, target.author_id, -removedWeight);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
