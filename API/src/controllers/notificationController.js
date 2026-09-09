import { Notification } from '../models/Notification.js';
import { AppError } from '../utils/AppError.js';

function notificationId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(422, 'INVALID_NOTIFICATION_ID', 'Notification id must be a positive integer');
  }
  return id;
}

export async function listNotifications(req, res) {
  const userId = Number(req.user.sub);
  const unreadOnly = String(req.query.unread || '') === '1';
  const result = await Notification.list(userId, {
    unreadOnly,
    page: req.query.page,
    limit: req.query.limit,
  });
  result.unreadCount = await Notification.unreadCount(userId);
  res.json(result);
}

export async function markNotificationRead(req, res) {
  const found = await Notification.markRead(
    Number(req.user.sub),
    notificationId(req.params.notification_id),
  );
  if (!found) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  res.json({ data: { read: true } });
}

export async function markAllNotificationsRead(req, res) {
  const updated = await Notification.markAllRead(Number(req.user.sub));
  res.json({ data: { updated } });
}

export async function deleteNotification(req, res) {
  const found = await Notification.remove(
    Number(req.user.sub),
    notificationId(req.params.notification_id),
  );
  if (!found) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  res.status(204).end();
}
