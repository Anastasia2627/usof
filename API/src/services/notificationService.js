import { pool } from '../config/db.js';

async function actorLogin(actorId) {
  if (!actorId) return 'Someone';
  const [[actor]] = await pool.query('SELECT login FROM users WHERE id=? LIMIT 1', [actorId]);
  return actor?.login || 'Someone';
}

export async function createNotification({ userId, actorId = null, type, postId = null, commentId = null, title, body = '' }) {
  if (!userId || Number(userId) === Number(actorId)) return false;
  await pool.execute(
    `INSERT INTO notifications(user_id,actor_id,type,post_id,comment_id,title,body)
     VALUES(?,?,?,?,?,?,?)`,
    [userId, actorId, type, postId, commentId, title, body],
  );
  return true;
}

export async function notifyPostFollowers({ postId, actorId, type, commentId = null, excludeUserIds = [] }) {
  const [followers] = await pool.execute('SELECT user_id FROM post_subscriptions WHERE post_id=?', [postId]);
  const actor = await actorLogin(actorId);
  const excluded = new Set([Number(actorId), ...excludeUserIds.map(Number)]);
  const copy = type === 'post_updated'
    ? { title: 'A followed question was updated', body: `${actor} updated a question you follow.` }
    : {
      title: type === 'reply' ? 'New reply in a followed discussion' : 'New answer on a question you follow',
      body: `${actor} added ${type === 'reply' ? 'a reply' : 'an answer'} to a question you follow.`,
    };
  const recipients = [...new Set(followers.map((row) => Number(row.user_id)).filter((userId) => !excluded.has(userId)))];
  await Promise.all(recipients.map((userId) => createNotification({ userId, actorId, type, postId, commentId, ...copy })));
}

export async function notifyReplyAuthor({ parentAuthorId, actorId, postId, commentId }) {
  const actor = await actorLogin(actorId);
  return createNotification({
    userId: parentAuthorId,
    actorId,
    type: 'reply',
    postId,
    commentId,
    title: 'Someone replied to your comment',
    body: `${actor} replied to your comment.`,
  });
}

export async function notifyPositiveReaction({ targetAuthorId, actorId, postId = null, commentId = null, type }) {
  if (!['like', 'useful', 'fire', 'thanks'].includes(type)) return false;
  const actor = await actorLogin(actorId);
  const targetLabel = commentId ? 'answer' : 'question';
  return createNotification({
    userId: targetAuthorId,
    actorId,
    type: 'reaction',
    postId,
    commentId,
    title: `Your ${targetLabel} received ${type}`,
    body: `${actor} reacted to your ${targetLabel}.`,
  });
}

export async function notifyPostAuthor({ postAuthorId, actorId, postId, commentId, isReply = false }) {
  const actor = await actorLogin(actorId);
  return createNotification({
    userId: postAuthorId,
    actorId,
    type: isReply ? 'reply' : 'comment',
    postId,
    commentId,
    title: isReply ? 'New reply on your question' : 'New answer on your question',
    body: `${actor} added ${isReply ? 'a reply' : 'an answer'} to your question.`,
  });
}

export async function deliverNotifications(tasks) {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  for (const result of results) {
    if (result.status === 'rejected' && process.env.NODE_ENV !== 'production') {
      console.error('Notification delivery failed:', result.reason?.message || result.reason);
    }
  }
}
