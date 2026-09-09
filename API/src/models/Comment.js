import { BaseModel } from './BaseModel.js';

export class Comment extends BaseModel {
  static async findById(id) {
    const rows = await this.query(
      `SELECT c.*, u.login AS author_login, u.avatar AS author_avatar,
              p.author_id AS post_author_id, p.status AS post_status, p.locked AS post_locked,
              COALESCE((
                SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)
                FROM reactions r
                WHERE r.comment_id = c.id
              ), 0) AS score
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
      `SELECT c.*, u.login AS author_login, p.title AS post_title,
              COALESCE((
                SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)
                FROM reactions r
                WHERE r.comment_id = c.id
              ), 0) AS score
       FROM comments c
       JOIN users u ON u.id = c.author_id
       JOIN posts p ON p.id = c.post_id
       ${clause}
       ORDER BY c.created_at DESC`,
      params,
    );
  }

  static async listForPost(postId, user) {
    const params = [postId];
    let visibility = "c.status='active'";
    if (user?.role === 'admin') {
      visibility = '1=1';
    } else if (user) {
      visibility = "(c.status='active' OR c.author_id=?)";
      params.push(Number(user.sub));
    }

    return this.query(
      `SELECT c.*, u.login AS author_login, u.avatar AS author_avatar,
              COALESCE((
                SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)
                FROM reactions r
                WHERE r.comment_id = c.id
              ), 0) AS score
       FROM comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id=? AND ${visibility}
       ORDER BY score ASC, c.created_at ASC`,
      params,
    );
  }
}
