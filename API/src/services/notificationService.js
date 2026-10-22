import { pool } from '../config/db.js';

async function actorLogin(actorId, database = pool) {
  if (!actorId) return 'Someone';
  const [[actor]] = await database.query('SELECT login FROM users WHERE id=? LIMIT 1', [actorId]);
  return actor?.login || 'Someone';
}

export async function createNotification({ userId, actorId = null, type, postId = null, commentId = null, title, body = '' }, database = pool) {
  if (!userId || Number(userId) === Number(actorId)) return false;
  await database.execute(
    `INSERT INTO notifications(user_id,actor_id,type,post_id,comment_id,title,body)
     VALUES(?,?,?,?,?,?,?)`,
    [userId, actorId, type, postId, commentId, title, body],
  );
  return true;
}

export async function notifyPostFollowers({ postId, actorId, type, commentId = null, excludeUserIds = [] }, database = pool) {
  const actor = actorId ? (await database.query('SELECT login FROM users WHERE id=? LIMIT 1',[actorId]))[0][0]?.login || 'Someone' : 'Someone';
  const excluded = new Set([Number(actorId), ...excludeUserIds.map(Number)]);
  const copy = type === 'post_updated'
    ? { title: 'A followed question was updated', body: `${actor} updated a question you follow.` }
    : {
      title: type === 'reply' ? 'New reply in a followed discussion' : 'New answer on a question you follow',
      body: `${actor} added ${type === 'reply' ? 'a reply' : 'an answer'} to a question you follow.`,
    };
  // A single INSERT ... SELECT is atomic, unlike one INSERT per follower
  // It can be retried after a deadlock without duplicating partial successes
  const blocked=[...excluded].filter(Number.isSafeInteger);
  const ignoreSql=blocked.length
    ? ' AND ps.user_id NOT IN ('+blocked.map(()=>'?').join(',')+')':'';
  await database.execute(
    `INSERT INTO notifications(user_id,actor_id,type,post_id,comment_id,title,body)
     SELECT ps.user_id,?,?,?,?,?,?
     FROM post_subscriptions ps
     WHERE ps.post_id=?${ignoreSql}`,
    [actorId,type,postId,commentId,copy.title,copy.body,postId,...blocked],
  );
}

export async function notifyReplyAuthor({ parentAuthorId, actorId, postId, commentId }, database = pool) {
  const actor = await actorLogin(actorId,database);
  return createNotification({
    userId: parentAuthorId,
    actorId,
    type: 'reply',
    postId,
    commentId,
    title: 'Someone replied to your comment',
    body: `${actor} replied to your comment.`,
  }, database);
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

export async function notifyPostAuthor({ postAuthorId, actorId, postId, commentId, isReply = false }, database = pool) {
  const actor = await actorLogin(actorId,database);
  return createNotification({
    userId: postAuthorId,
    actorId,
    type: isReply ? 'reply' : 'comment',
    postId,
    commentId,
    title: isReply ? 'New reply on your question' : 'New answer on your question',
    body: `${actor} added ${isReply ? 'a reply' : 'an answer'} to your question.`,
  }, database);
}

// A failed INSERT after the associated post/comment is committed must not be
// silently lost. Retry only DB errors for which MySQL rejects the statement
// without writing it; network/connection errors are deliberately not retried,
// because the INSERT may already have reached the server.
export function retryableNotificationError(error) {
  return ['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT','ER_CON_COUNT_ERROR']
    .includes(error?.code) || [1213,1205,1040].includes(Number(error?.errno));
}

export async function deliverNotifications(tasks, {
  maxAttempts=3, delayMs=75, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
  logger=console,
} = {}) {
  const attempts=Math.max(1,Math.min(3,Math.floor(Number(maxAttempts)||1)));
  const outcomes=await Promise.allSettled(tasks.map(async task=>{
    for(let attempt=1;attempt<=attempts;attempt++){
      try{return await task();}
      catch(error){
        if(attempt>=attempts || !retryableNotificationError(error))throw error;
        await sleep(delayMs*attempt);
      }
    }
    return null;
  }));
  const failures=outcomes.filter(x=>x.status==='rejected');
  if(failures.length){
    // Error descriptions can include SQL parameters, including private
    // messages and recipient addresses, so only log codes and totals.
    logger.error('Notification writes failed',{
      attempted:tasks.length,
      failed:failures.length,
      codes:failures.map(x=>String(x.reason?.code||'UNKNOWN').slice(0,40)),
    });
  }
  return {attempted:tasks.length,succeeded:outcomes.length-failures.length,
    failed:failures.length};
}
