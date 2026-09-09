import { BaseModel } from './BaseModel.js';

export class Post extends BaseModel {
  static async findCoreById(id) {
    const rows = await this.query(
      'SELECT id, author_id, status, locked FROM posts WHERE id=? LIMIT 1',
      [id],
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const rows = await this.query(
      `SELECT p.*, u.login AS author_login, u.avatar AS author_avatar,
              COALESCE((
                SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)
                FROM reactions r
                WHERE r.post_id = p.id
              ), 0) AS score
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.id=?
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    return (await this.attachCategories(rows))[0];
  }

  static async attachCategories(posts) {
    if (!posts.length) return posts;
    const ids = posts.map((post) => Number(post.id));
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.query(
      `SELECT pc.post_id, c.id, c.title, c.description
       FROM post_categories pc
       JOIN categories c ON c.id = pc.category_id
       WHERE pc.post_id IN (${placeholders})
       ORDER BY c.title`,
      ids,
    );

    const categoriesByPost = new Map(ids.map((id) => [id, []]));
    for (const row of rows) {
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

  static async list({ clause = '', params = [], sort, order, limit, offset }) {
    const countRows = await this.query(
      `SELECT COUNT(*) AS total
       FROM posts p
       JOIN users u ON u.id = p.author_id
       ${clause}`,
      params,
    );

    const rows = await this.query(
      `SELECT p.*, u.login AS author_login, u.avatar AS author_avatar,
              COALESCE((
                SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 ELSE 0 END)
                FROM reactions r
                WHERE r.post_id = p.id
              ), 0) AS score
       FROM posts p
       JOIN users u ON u.id = p.author_id
       ${clause}
       ORDER BY ${sort} ${order}, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      posts: await this.attachCategories(rows),
      total: Number(countRows[0].total),
    };
  }
}
