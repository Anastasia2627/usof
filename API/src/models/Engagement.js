import { BaseModel } from './BaseModel.js';
import { Post } from './Post.js';
import { preparePostMedia } from '../services/postMediaAccess.js';

const LIST_SORT = {
  date: 'p.created_at',
  likes: 'like_count',
  trending: 'trend_score',
};

function normalizeListOptions({ page = 1, limit = 10, sort = 'date', order = 'desc' } = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
  const safeSort = LIST_SORT[sort] || LIST_SORT.date;
  const safeOrder = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return {
    page: safePage,
    limit: safeLimit,
    sort: safeSort,
    order: safeOrder,
  };
}

async function listPostsForUser(viewer, relationTable, options) {
  const userId = Number(viewer.sub);
  const normalized = normalizeListOptions(options);
  const relationColumn = relationTable === 'favorites' ? 'favorites' : 'post_subscriptions';
  const clause = `
    WHERE ((p.status='active' AND (p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP()))
      OR p.author_id=?)
      AND EXISTS(
        SELECT 1
        FROM ${relationColumn} relation_item
        WHERE relation_item.post_id=p.id AND relation_item.user_id=?
      )
  `;
  const { posts, total } = await Post.list({
    clause,
    params: [userId, userId],
    sort: normalized.sort,
    order: normalized.order,
    limit: normalized.limit,
    offset: (normalized.page - 1) * normalized.limit,
  });
  return {
    data: posts.map(post=>preparePostMedia(
      post.hide_likes && Number(post.author_id)!==Number(userId) && !['admin','moderator'].includes(viewer.role)
        ? {...post,like_count:null,dislike_count:null,score:null}
        : post,
      viewer,
    )),
    pagination: {
      page: normalized.page,
      limit: normalized.limit,
      total,
      totalPages: Math.ceil(total / normalized.limit),
    },
  };
}

export class Engagement extends BaseModel {
  static async favoriteState(userId, postId) {
    const rows = await this.query(
      'SELECT 1 AS saved FROM favorites WHERE user_id=? AND post_id=? LIMIT 1',
      [userId, postId],
    );
    return Boolean(rows[0]);
  }

  static async followState(userId, postId) {
    const rows = await this.query(
      'SELECT 1 AS following FROM post_subscriptions WHERE user_id=? AND post_id=? LIMIT 1',
      [userId, postId],
    );
    return Boolean(rows[0]);
  }

  static async savePost(userId, postId) {
    await this.query(
      'INSERT IGNORE INTO favorites(user_id,post_id) VALUES(?,?)',
      [userId, postId],
    );
  }

  static async unsavePost(userId, postId) {
    const result = await this.query(
      'DELETE FROM favorites WHERE user_id=? AND post_id=?',
      [userId, postId],
    );
    return result.affectedRows > 0;
  }

  static async followPost(userId, postId) {
    await this.query(
      'INSERT IGNORE INTO post_subscriptions(user_id,post_id) VALUES(?,?)',
      [userId, postId],
    );
  }

  static async unfollowPost(userId, postId) {
    const result = await this.query(
      'DELETE FROM post_subscriptions WHERE user_id=? AND post_id=?',
      [userId, postId],
    );
    return result.affectedRows > 0;
  }

  static async listFavorites(viewer, options) {
    return listPostsForUser(viewer, 'favorites', options);
  }

  static async listFollowing(viewer, options) {
    return listPostsForUser(viewer, 'post_subscriptions', options);
  }

  static async recordShare(postId, userId, channel) {
    const result = await this.query(
      'INSERT INTO post_shares(post_id,user_id,channel) VALUES(?,?,?)',
      [postId, userId || null, channel],
    );
    return Number(result.insertId);
  }

  static async shareCount(postId) {
    const rows = await this.query(
      'SELECT COUNT(*) AS count FROM post_shares WHERE post_id=?',
      [postId],
    );
    return Number(rows[0]?.count || 0);
  }
}
