import { pool } from '../config/db.js';
import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt, validateStatus } from '../utils/validation.js';
import { recalculateAllRatings } from './reactionService.js';
import { assertMayModerateComment } from './moderationPolicy.js';
import {
  deliverNotifications,
  notifyPostAuthor,
  notifyPostFollowers,
  notifyReplyAuthor,
} from './notificationService.js';

export async function getVisiblePostCore(idValue, user) {
  const postId = positiveInt(idValue, 'INVALID_POST_ID', 'Invalid post id');
  const post = await Post.findCoreById(postId);
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  const ownsPost = user && Number(user.sub) === Number(post.author_id);
  const scheduled = Boolean(post.publish_at && new Date(post.publish_at)>new Date());
  if (((post.status==='inactive' && !['admin','moderator'].includes(user?.role)) ||
      (scheduled && user?.role!=='admin')) && !ownsPost) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  }
  return post;
}

export async function getVisibleComment(
  idValue,
  user,
  { requireActiveComment = false, requireActivePost = false } = {},
) {
  const id = positiveInt(idValue, 'INVALID_COMMENT_ID', 'Invalid comment id');
  const comment = await Comment.findById(id);
  if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');

  const isAdmin = ['admin','moderator'].includes(user?.role);
  const ownsPost = user && Number(user.sub) === Number(comment.post_author_id);
  const scheduled=Boolean(comment.post_publish_at && new Date(comment.post_publish_at)>new Date());
  if ((comment.post_status==='inactive' && !isAdmin && (requireActivePost || !ownsPost)) ||
      (scheduled && user?.role!=='admin' && !ownsPost)) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }
  if (requireActivePost && comment.post_status !== 'active' && !isAdmin) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }
  if (requireActiveComment && comment.status !== 'active' && !isAdmin) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }
  return comment;
}

export async function listAdminComments(query,actor) {
  const where = [];
  const params = [];
  if (query.status) {
    where.push('c.status=?');
    params.push(validateStatus(query.status));
  }
  if (query.post_id) {
    where.push('c.post_id=?');
    params.push(positiveInt(query.post_id, 'INVALID_POST_ID', 'Invalid post id'));
  }
  if(actor?.role==='moderator') {
    where.push('(p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP() OR p.author_id=?)');
    params.push(Number(actor.sub));
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return Comment.listAdmin({ clause, params });
}

export async function listCommentsForPost(idValue, user) {
  const post = await getVisiblePostCore(idValue, user);
  const comments = await Comment.listForPost(post.id);
  const moderator = ['admin','moderator'].includes(user?.role);
  return comments.map(comment => {
    const mayRead = moderator || comment.status === 'active' ||
      Number(user?.sub) === Number(comment.author_id) ||
      Number(user?.sub) === Number(post.author_id);
    return mayRead ? comment : {
      ...comment,
      content: '[Comment hidden by moderation]',
    };
  });
}

export async function createCommentForUser(user, postIdValue, body) {
  if (typeof body.content !== 'string')
    throw new AppError(422,'VALIDATION_ERROR','content must be a string');
  const content = body.content.trim();
  if (!content) throw new AppError(422, 'VALIDATION_ERROR', 'content is required');
  if (content.length > 20000 || Buffer.byteLength(content,'utf8') > 60000) {
    throw new AppError(422, 'CONTENT_TOO_LONG', 'content must contain at most 20000 characters and fit in 60000 UTF-8 bytes');
  }

  const post = await getVisiblePostCore(postIdValue, user);
  const isAdmin = ['admin','moderator'].includes(user.role);
  if (!isAdmin && post.status !== 'active') {
    throw new AppError(404, 'POST_NOT_AVAILABLE', 'Active post not found');
  }
  if (!isAdmin && post.locked) throw new AppError(423, 'POST_LOCKED', 'This post is locked');
  if (post.closed) throw new AppError(423, 'POST_CLOSED', 'The author has closed this discussion');
  if (post.publish_at && new Date(post.publish_at) > new Date()) throw new AppError(423, 'POST_SCHEDULED', 'This discussion is not published yet');

  let parent = null;
  if (body.parentCommentId !== undefined && body.parentCommentId !== null) {
    parent = await getVisibleComment(body.parentCommentId, user);
    if (Number(parent.post_id) !== Number(post.id)) {
      throw new AppError(422, 'INVALID_PARENT', 'Parent comment belongs to another post');
    }
    if (!isAdmin && (parent.status !== 'active' || parent.locked)) {
      throw new AppError(423, 'COMMENT_LOCKED', 'This comment cannot receive replies');
    }
  }

  const actorId = Number(user.sub);
  const connection=await pool.getConnection();
  let commentId;
  try {
    await connection.beginTransaction();
    // Serialize comment creation with post lock/close/reschedule actions
    const [[currentPost]]=await connection.execute(
      'SELECT id,status,locked,closed,publish_at FROM posts WHERE id=? FOR UPDATE',
      [post.id],
    );
    if(!currentPost) throw new AppError(404,'POST_NOT_FOUND','Post not found');
    if(!isAdmin && currentPost.status!=='active')
      throw new AppError(404,'POST_NOT_AVAILABLE','Active post not found');
    if(!isAdmin && currentPost.locked)
      throw new AppError(423,'POST_LOCKED','This post is locked');
    if(currentPost.closed)
      throw new AppError(423,'POST_CLOSED','The author has closed this discussion');
    if(currentPost.publish_at &&
       new Date(currentPost.publish_at).getTime()>Date.now())
      throw new AppError(423,'POST_SCHEDULED','This discussion is not published yet');

    if(parent){
      const [[currentParent]]=await connection.execute(
        'SELECT id,post_id,status,locked FROM comments WHERE id=? FOR UPDATE',
        [parent.id],
      );
      if(!currentParent || Number(currentParent.post_id)!==Number(post.id))
        throw new AppError(422,'INVALID_PARENT','Parent comment belongs to another post');
      if(!isAdmin && (currentParent.status!=='active' || currentParent.locked))
        throw new AppError(423,'COMMENT_LOCKED','This comment cannot receive replies');
    }
    const [result]=await connection.execute(
      "INSERT INTO comments(post_id,author_id,parent_comment_id,content,status,locked) VALUES(?,?,?,?,'active',0)",
      [post.id,actorId,parent?.id || null,content],
    );
    commentId=Number(result.insertId);
    await connection.commit();
  } catch(error) {
    await connection.rollback();
    throw error;
  } finally {connection.release();}
  const comment = await getVisibleComment(commentId, user);
  const excludedFollowerIds = [Number(post.author_id)];
  if (parent) excludedFollowerIds.push(Number(parent.author_id));

  await deliverNotifications([
    () => notifyPostAuthor({
      postAuthorId: Number(post.author_id),
      actorId,
      postId: Number(post.id),
      commentId: Number(comment.id),
      isReply: Boolean(parent),
    }),
    () => parent
      ? notifyReplyAuthor({
        parentAuthorId: Number(parent.author_id),
        actorId,
        postId: Number(post.id),
        commentId: Number(comment.id),
      })
      : Promise.resolve(false),
    () => notifyPostFollowers({
      postId: Number(post.id),
      actorId,
      type: parent ? 'reply' : 'comment',
      commentId: Number(comment.id),
      excludeUserIds: excludedFollowerIds,
    }),
  ]);

  return comment;
}

export async function updateCommentForUser(user, idValue, body) {
  const comment = await getVisibleComment(idValue, user);
  const isAdmin = ['admin','moderator'].includes(user.role);
  if (user.role === 'moderator' &&
      (Number(user.sub) !== Number(comment.author_id) || body.locked !== undefined))
    await assertMayModerateComment(user, comment);
  if (user.role === 'user' && Number(user.sub) !== Number(comment.author_id)) {
    // The assignment permits member status updates on other members' comments,
    // but no member should be able to hide an administrator's reply or discussion.
    const [[protectedAuthor]] = await pool.query(
      `SELECT 1 FROM users WHERE role='admin' AND id IN (?,?) LIMIT 1`,
      [comment.author_id, comment.post_author_id],
    );
    if (protectedAuthor)
      throw new AppError(403,'ADMIN_CONTENT_PROTECTED','Administrator discussions are protected');
  }
  if (body.content !== undefined) {
    throw new AppError(
      403,
      'COMMENT_CONTENT_IMMUTABLE',
      'Comment content cannot be edited; only status can be changed',
    );
  }
  if (!isAdmin && body.locked !== undefined) {
    throw new AppError(403, 'ADMIN_REQUIRED', 'Only admins can lock comments');
  }
  if (comment.locked && !isAdmin) {
    throw new AppError(423, 'COMMENT_LOCKED', 'This comment is locked');
  }

  let status = comment.status;
  let locked = Boolean(comment.locked);
  let changed = false;
  if (body.status !== undefined) {
    status = validateStatus(body.status);
    changed = true;
  }
  if (body.locked !== undefined) {
    if (typeof body.locked !== 'boolean')
      throw new AppError(422,'INVALID_LOCKED','locked must be boolean');
    locked = body.locked;
    changed = true;
  }
  if (!changed) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      isAdmin ? 'Provide status or locked to update' : 'Provide status to update',
    );
  }

  const connection=await pool.getConnection();
  try{
    await connection.beginTransaction();
    // A moderator may lock a comment between the first read and this update
    // Lock both the comment and its parent post to validate the latest state
    const [[fresh]]=await connection.execute(
      `SELECT c.id,c.author_id,c.locked,p.author_id AS post_author_id,
              p.status AS post_status,p.publish_at AS post_publish_at
       FROM comments c JOIN posts p ON p.id=c.post_id
       WHERE c.id=? FOR UPDATE`,
      [comment.id],
    );
    if(!fresh) throw new AppError(404,'COMMENT_NOT_FOUND','Comment not found');
    if(!isAdmin && fresh.locked)
      throw new AppError(423,'COMMENT_LOCKED','This comment is locked');
    const ownsThread=Number(user.sub)===Number(fresh.post_author_id);
    const scheduled=Boolean(fresh.post_publish_at &&
      new Date(fresh.post_publish_at).getTime()>Date.now());
    if((!isAdmin && fresh.post_status!=='active' && !ownsThread) ||
       (scheduled && user.role!=='admin' && !ownsThread))
      throw new AppError(404,'COMMENT_NOT_FOUND','Comment not found');
    if(user.role==='moderator' &&
       (Number(user.sub)!==Number(fresh.author_id) || body.locked!==undefined))
      await assertMayModerateComment(user,fresh,connection);
    if(user.role==='user' && Number(user.sub)!==Number(fresh.author_id)){
      const [[protectedAuthor]]=await connection.query(
        `SELECT id FROM users WHERE role='admin' AND id IN (?,?) LIMIT 1`,
        [fresh.author_id,fresh.post_author_id],
      );
      if(protectedAuthor)
        throw new AppError(403,'ADMIN_CONTENT_PROTECTED',
          'Administrator discussions are protected');
    }
    // Update only fields explicitly supplied — a lock-only request must not
    // accidentally restore a status from a stale read
    const changes=[];
    const params=[];
    if(body.status!==undefined){changes.push('status=?');params.push(status);}
    if(body.locked!==undefined){changes.push('locked=?');params.push(locked?1:0);}
    await connection.execute('UPDATE comments SET '+changes.join(',')+' WHERE id=?',
      [...params,comment.id]);
    if(body.status!==undefined && status==='inactive')
      await connection.execute(
        'UPDATE posts SET accepted_comment_id=NULL WHERE accepted_comment_id=?',
        [comment.id],
      );
    await connection.commit();
  }catch(error){await connection.rollback();throw error;}
  finally{connection.release();}
  return getVisibleComment(comment.id, user);
}

export async function deleteCommentForUser(user, idValue) {
  const comment = await getVisibleComment(idValue, user);
  if (!['admin','moderator'].includes(user.role) && Number(user.sub) !== Number(comment.author_id)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete this comment');
  }
  if (user.role === 'moderator' && Number(user.sub)!==Number(comment.author_id))
    await assertMayModerateComment(user,comment);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[fresh]]=await connection.execute(
      `SELECT c.id,c.author_id,c.locked,p.author_id AS post_author_id,
              p.status AS post_status,p.publish_at AS post_publish_at
       FROM comments c JOIN posts p ON p.id=c.post_id
       WHERE c.id=? FOR UPDATE`,
      [comment.id],
    );
    if(!fresh) throw new AppError(404,'COMMENT_NOT_FOUND','Comment not found');
    if(!['admin','moderator'].includes(user.role) && fresh.locked)
      throw new AppError(423,'COMMENT_LOCKED','This comment is locked');
    if(!['admin','moderator'].includes(user.role) &&
       Number(user.sub)!==Number(fresh.author_id))
      throw new AppError(403,'FORBIDDEN','Cannot delete this comment');
    const ownsThread=Number(user.sub)===Number(fresh.post_author_id);
    const scheduled=Boolean(fresh.post_publish_at &&
      new Date(fresh.post_publish_at).getTime()>Date.now());
    if((fresh.post_status!=='active' && user.role==='user' && !ownsThread) ||
       (scheduled && user.role!=='admin' && !ownsThread))
      throw new AppError(404,'COMMENT_NOT_FOUND','Comment not found');
    if(user.role==='moderator' && Number(user.sub)!==Number(fresh.author_id))
      await assertMayModerateComment(user,fresh,connection);
    await connection.query('DELETE FROM comments WHERE id=?', [comment.id]);
    await recalculateAllRatings(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
