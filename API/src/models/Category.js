import { BaseModel } from './BaseModel.js';
import { Post } from './Post.js';

export class Category extends BaseModel {
  static async list() {
    return this.query(`SELECT c.id,c.title,c.description,
        (SELECT COUNT(*) FROM post_categories pc
          JOIN posts p ON p.id=pc.post_id
          WHERE pc.category_id=c.id AND p.status='active'
            AND (p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP())
        ) AS post_count
      FROM categories c ORDER BY c.title`);
  }

  static async search(term) {
    return this.query('SELECT id, title, description FROM categories WHERE title LIKE ? OR description LIKE ? ORDER BY title LIMIT 20', [term, term]);
  }

  static async findById(id) {
    const rows = await this.query(
      'SELECT id, title, description FROM categories WHERE id=? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  }

  static async create({ title, description }) {
    const result = await this.query(
      'INSERT INTO categories(title, description) VALUES(?, ?)',
      [title, description],
    );
    return this.findById(result.insertId);
  }

  static async update(id, { title, description }) {
    await this.query(
      `UPDATE categories
       SET title=COALESCE(?, title), description=COALESCE(?, description)
       WHERE id=?`,
      [title ?? null, description ?? null, id],
    );
    return this.findById(id);
  }

  static async remove(id) {
    const result = await this.query('DELETE FROM categories WHERE id=?', [id]);
    return result.affectedRows > 0;
  }

  static async postsForCategory(id, user) {
    const conditions = ['EXISTS(SELECT 1 FROM post_categories pc WHERE pc.post_id=p.id AND pc.category_id=?)'];
    const params = [id];
    // Scheduled drafts of other members stay private for moderators
    if (user?.role === 'moderator') {
      conditions.push('(p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP() OR p.author_id=?)');
      params.push(Number(user.sub));
    } else if (user?.role !== 'admin') {
      if (user) {
        conditions.push("((p.status='active' AND (p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP())) OR p.author_id=?)");
        params.push(Number(user.sub));
      } else {
        conditions.push("p.status='active' AND (p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP())");
      }
    }

    // Reuse the Post model so category previews contain exactly the same
    // author, counts, scores and categories as the main feed.
    const { posts } = await Post.list({
      clause: `WHERE ${conditions.join(' AND ')}`,
      params,
      sort: 'p.created_at',
      order: 'DESC',
      limit: 50,
      offset: 0,
    });
    return posts;
  }
}
