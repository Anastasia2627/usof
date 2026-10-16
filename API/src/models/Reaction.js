import { BaseModel } from './BaseModel.js';

export class Reaction extends BaseModel {
  static async listAdmin({ limit = 100 } = {}) {
    return this.query(
      `SELECT r.id, r.author_id, u.login AS author_login, r.post_id, r.comment_id,
              r.type, r.created_at, COALESCE(p.title, cp.title) AS post_title
       FROM reactions r
       JOIN users u ON u.id=r.author_id
       LEFT JOIN posts p ON p.id=r.post_id
       LEFT JOIN comments c ON c.id=r.comment_id
       LEFT JOIN posts cp ON cp.id=c.post_id
       ORDER BY r.created_at DESC, r.id DESC LIMIT ?`,
      [limit],
    );
  }

  static async findById(id) {
    const rows = await this.query(
      'SELECT id, author_id, post_id, comment_id, type FROM reactions WHERE id=? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  }

  static async listForPost(postId) {
    return this.query(
      `SELECT r.id, r.author_id, u.login AS author_login, r.type, r.created_at
       FROM reactions r
       JOIN users u ON u.id = r.author_id
       WHERE r.post_id=?
       ORDER BY r.created_at`,
      [postId],
    );
  }

  static async listForComment(commentId) {
    return this.query(
      `SELECT r.id, r.author_id, u.login AS author_login, r.type, r.created_at
       FROM reactions r
       JOIN users u ON u.id = r.author_id
       WHERE r.comment_id=?
       ORDER BY r.created_at`,
      [commentId],
    );
  }
}
