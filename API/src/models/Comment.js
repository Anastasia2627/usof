import { BaseModel } from './BaseModel.js';

const COMMENT_SCORE_SQL = `
  COALESCE((
    SELECT SUM(
      CASE r.type
        WHEN 'like' THEN 1
        WHEN 'dislike' THEN -1
        WHEN 'useful' THEN 2
        WHEN 'thanks' THEN 1
        WHEN 'fire' THEN 1
        ELSE 0
      END
    )
    FROM reactions r
    WHERE r.comment_id = c.id
  ), 0)
`;

const COMMENT_LIKE_COUNT_SQL = `
  COALESCE((
    SELECT COUNT(*)
    FROM reactions r
    WHERE r.comment_id = c.id AND r.type = 'like'
  ), 0)
`;

export class Comment extends BaseModel {
  static async findById(id) {
    const rows = await this.query(
      `SELECT c.*, u.login AS author_login, u.avatar AS author_avatar, u.rating AS author_rating,
              p.author_id AS post_author_id, p.status AS post_status, p.locked AS post_locked,
              ${COMMENT_SCORE_SQL} AS score,
              ${COMMENT_LIKE_COUNT_SQL} AS like_count
       FROM comments c
       JOIN users u ON u.id = c.author_id
       JOIN posts p ON p.id = c.post_id
       WHERE c.id=?
       LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  static async listAdmin({ clause = '', params = [] } = {}) {
    return this.query(
      `SELECT c.*, u.login AS author_login, u.rating AS author_rating, p.title AS post_title,
              ${COMMENT_SCORE_SQL} AS score,
              ${COMMENT_LIKE_COUNT_SQL} AS like_count
       FROM comments c
       JOIN users u ON u.id = c.author_id
       JOIN posts p ON p.id = c.post_id
       ${clause}
       ORDER BY c.created_at DESC`,
      params,
    );
  }

  static async listForPost(postId) {
    return this.query(
      `SELECT c.*, u.login AS author_login, u.avatar AS author_avatar, u.rating AS author_rating,
              ${COMMENT_SCORE_SQL} AS score,
              ${COMMENT_LIKE_COUNT_SQL} AS like_count
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id=?
       ORDER BY like_count ASC, c.created_at ASC, c.id ASC`,
      [postId],
    );
  }
}
