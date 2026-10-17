import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

// The administrator has final authority. Moderators can moderate community
// posts, but cannot alter administrator posts, comments or administrator votes.
export async function assertMayModerateAuthors(actor, authorIds, db = pool) {
  if (actor?.role === 'admin') return;
  if (actor?.role !== 'moderator') {
    throw new AppError(403, 'MODERATOR_REQUIRED', 'Moderator permission required');
  }
  const ids = [...new Set(authorIds.map(Number).filter(Number.isSafeInteger))];
  if (!ids.length) return;
  const [rows] = await db.query(
    `SELECT id FROM users WHERE role='admin' AND id IN (${ids.map(() => '?').join(',')}) LIMIT 1`,
    ids,
  );
  if (rows.length) {
    throw new AppError(403, 'ADMIN_CONTENT_PROTECTED',
      'Moderators cannot change administrator content');
  }
}

// For comments, the post author and the commenter must both be considered:
// moderating a reply within an administrator's discussion affects that thread.
export async function assertMayModerateComment(actor, comment, db = pool) {
  await assertMayModerateAuthors(actor,
    [comment.author_id, comment.post_author_id], db);
}

export async function assertMayModerateReaction(actor, reaction, db = pool) {
  if (actor?.role === 'admin') return;
  const [[target]] = await db.query(
    `SELECT r.author_id AS voter_id,
       COALESCE(p.author_id,c.author_id) AS target_author_id,
       COALESCE(p.author_id,cp.author_id) AS post_author_id
     FROM reactions r
     LEFT JOIN posts p ON p.id=r.post_id
     LEFT JOIN comments c ON c.id=r.comment_id
     LEFT JOIN posts cp ON cp.id=c.post_id
     WHERE r.id=? LIMIT 1`, [reaction.id],
  );
  if (!target) throw new AppError(404,'REACTION_NOT_FOUND','Reaction not found');
  await assertMayModerateAuthors(actor,
    [target.voter_id,target.target_author_id,target.post_author_id],db);
}
