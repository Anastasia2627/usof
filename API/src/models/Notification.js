import { BaseModel } from './BaseModel.js';

export class Notification extends BaseModel {
  static async list(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const where = ['n.user_id=?'];
    const params = [userId];
    if (unreadOnly) where.push('n.read_at IS NULL');

    const countRows = await this.query(
      `SELECT COUNT(*) AS total
       FROM notifications n
       WHERE ${where.join(' AND ')}`,
      params,
    );

    const rows = await this.query(
      `SELECT n.*, actor.login AS actor_login, actor.avatar AS actor_avatar,
              p.title AS post_title
       FROM notifications n
       LEFT JOIN users actor ON actor.id=n.actor_id
       LEFT JOIN posts p ON p.id=n.post_id
       WHERE ${where.join(' AND ')}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ? OFFSET ?`,
      [...params, safeLimit, (safePage - 1) * safeLimit],
    );

    const total = Number(countRows[0]?.total || 0);
    return {
      data: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  static async unreadCount(userId) {
    const rows = await this.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL',
      [userId],
    );
    return Number(rows[0]?.count || 0);
  }

  static async markRead(userId, notificationId) {
    const result = await this.query(
      `UPDATE notifications
       SET read_at=COALESCE(read_at, NOW())
       WHERE id=? AND user_id=?`,
      [notificationId, userId],
    );
    return result.affectedRows > 0;
  }

  static async markAllRead(userId) {
    const result = await this.query(
      'UPDATE notifications SET read_at=NOW() WHERE user_id=? AND read_at IS NULL',
      [userId],
    );
    return Number(result.affectedRows || 0);
  }

  static async remove(userId, notificationId) {
    const result = await this.query(
      'DELETE FROM notifications WHERE id=? AND user_id=?',
      [notificationId, userId],
    );
    return result.affectedRows > 0;
  }
}
