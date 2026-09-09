import { BaseModel } from './BaseModel.js';

const SCORE_SQL = `
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
    WHERE r.post_id = p.id
  ), 0)
`;

const LIKE_COUNT_SQL = `
  COALESCE((SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.type = 'like'), 0)
`;
const COMMENT_COUNT_SQL = `
  COALESCE((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'active'), 0)
`;
const FAVORITE_COUNT_SQL = `
  COALESCE((SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id), 0)
`;
const FOLLOWER_COUNT_SQL = `
  COALESCE((SELECT COUNT(*) FROM post_subscriptions ps WHERE ps.post_id = p.id), 0)
`;
const SHARE_COUNT_SQL = `
  COALESCE((SELECT COUNT(*) FROM post_shares s WHERE s.post_id = p.id), 0)
`;
const TREND_SCORE_SQL = `
  (
    COALESCE((
      SELECT SUM(
        CASE r.type
          WHEN 'like' THEN 2
          WHEN 'useful' THEN 3
          WHEN 'thanks' THEN 2
          WHEN 'fire' THEN 1
          WHEN 'dislike' THEN -1
          ELSE 0
        END
      )
      FROM reactions r
      WHERE r.post_id = p.id AND r.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
    ), 0)
    + COALESCE((SELECT COUNT(*) * 2 FROM comments c WHERE c.post_id = p.id AND c.status = 'active' AND c.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)), 0)
    + COALESCE((SELECT COUNT(*) FROM favorites f WHERE f.post_id = p.id AND f.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)), 0)
    + COALESCE((SELECT COUNT(*) FROM post_shares s WHERE s.post_id = p.id AND s.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)), 0)
  )
`;

function metricsSql() {
  return `
    ${SCORE_SQL} AS score,
    ${LIKE_COUNT_SQL} AS like_count,
    ${COMMENT_COUNT_SQL} AS comment_count,
    ${FAVORITE_COUNT_SQL} AS favorite_count,
    ${FOLLOWER_COUNT_SQL} AS follower_count,
    ${SHARE_COUNT_SQL} AS share_count,
    ${TREND_SCORE_SQL} AS trend_score
  `;
}

export class Post extends BaseModel {
  static async findCoreById(id) {
    const rows = await this.query('SELECT id, author_id, status, locked FROM posts WHERE id=? LIMIT 1', [id]);
    return rows[0] || null;
  }

  static async findById(id) {
    const rows = await this.query(
      `SELECT p.*, u.login AS author_login, u.avatar AS author_avatar,
              ${metricsSql()}
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
    return posts.map((post) => ({ ...post, categories: categoriesByPost.get(Number(post.id)) || [] }));
  }

  static async list({ clause = '', params = [], sort, order, limit, offset }) {
    const countRows = await this.query(
      `SELECT COUNT(*) AS total FROM posts p JOIN users u ON u.id = p.author_id ${clause}`,
      params,
    );
    const rows = await this.query(
      `SELECT p.*, u.login AS author_login, u.avatar AS author_avatar,
              ${metricsSql()}
       FROM posts p
       JOIN users u ON u.id = p.author_id
       ${clause}
       ORDER BY ${sort} ${order}, p.created_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { posts: await this.attachCategories(rows), total: Number(countRows[0].total) };
  }
}
