import { pool } from '../config/db.js';
import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt, validateStatus } from '../utils/validation.js';
import { recalculateAllRatings } from './reactionService.js';
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
  if (post.status === 'inactive' && user?.role !== 'admin' && !ownsPost) {
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

  const isAdmin = user?.role === 'admin';
  const ownsPost = user && Number(user.sub) === Number(comment.post_author_id);
  if (comment.post_status === 'inactive' && !isAdmin && (requireActivePost || !ownsPost)) {
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

export async function listAdminComments(query) {
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
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return Comment.listAdmin({ clause, params });
}

export async function listCommentsForPost(idValue, user) {
  const post = await getVisiblePostCore(idValue, user);
  return Comment.listForPost(post.id);
}

export async function createCommentForUser(user, postIdValue, body) {
  const content = String(body.content ?? '').trim();
  if (!content) throw new AppError(422, 'VALIDATION_ERROR', 'content is required');
  if (content.length > 20000) {
    throw new AppError(422, 'CONTENT_TOO_LONG', 'content must contain at most 20000 characters');
  }

  const post = await getVisiblePostCore(postIdValue, user);
  const isAdmin = user.role === 'admin';
  if (!isAdmin && post.status !== 'active') {
    throw new AppError(404, 'POST_NOT_AVAILABLE', 'Active post not found');
  }
  if (!isAdmin && post.locked) throw new AppError(423, 'POST_LOCKED', 'This post is locked');

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
  const [result] = await pool.execute(
    "INSERT INTO comments(post_id,author_id,parent_comment_id,content,status,locked) VALUES(?,?,?,?,'active',0)",
    [post.id, actorId, parent?.id || null, content],
  );
  const comment = await getVisibleComment(result.insertId, user);
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
  const isAdmin = user.role === 'admin';
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
    locked = Boolean(body.locked);
    changed = true;
  }
  if (!changed) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      isAdmin ? 'Provide status or locked to update' : 'Provide status to update',
    );
  }

  await pool.execute(
    'UPDATE comments SET status=?, locked=? WHERE id=?',
    [status, locked ? 1 : 0, comment.id],
  );
  return getVisibleComment(comment.id, user);
}

export async function deleteCommentForUser(user, idValue) {
  const comment = await getVisibleComment(idValue, user);
  if (user.role !== 'admin' && Number(user.sub) !== Number(comment.author_id)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete this comment');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
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
