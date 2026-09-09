import { BaseModel } from './BaseModel.js';

export class Reaction extends BaseModel {
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
