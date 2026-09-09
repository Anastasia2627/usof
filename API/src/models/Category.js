import { BaseModel } from './BaseModel.js';

export class Category extends BaseModel {
  static async list() {
    return this.query('SELECT id, title, description FROM categories ORDER BY title');
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
    const conditions = ['pc.category_id=?'];
    const params = [id];
    if (user?.role !== 'admin') {
      if (user) {
        conditions.push("(p.status='active' OR p.author_id=?)");
        params.push(Number(user.sub));
      } else {
        conditions.push("p.status='active'");
      }
    }

    const posts = await this.query(
      `SELECT p.*, u.login AS author_login, u.avatar AS author_avatar,
              COALESCE((
                SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)
                FROM reactions r WHERE r.post_id=p.id
              ), 0) AS score
       FROM posts p
       JOIN users u ON u.id=p.author_id
       JOIN post_categories pc ON pc.post_id=p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.created_at DESC`,
      params,
    );

    if (!posts.length) return [];
    const postIds = posts.map((post) => Number(post.id));
    const placeholders = postIds.map(() => '?').join(',');
    const categoryRows = await this.query(
      `SELECT pc.post_id, c.id, c.title, c.description
       FROM post_categories pc
       JOIN categories c ON c.id=pc.category_id
       WHERE pc.post_id IN (${placeholders})
       ORDER BY c.title`,
      postIds,
    );
    const categoriesByPost = new Map(postIds.map((postId) => [postId, []]));
    for (const row of categoryRows) {
      categoriesByPost.get(Number(row.post_id))?.push({
        id: row.id,
        title: row.title,
        description: row.description,
      });
    }
    return posts.map((post) => ({
      ...post,
      categories: categoriesByPost.get(Number(post.id)) || [],
    }));
  }
}
