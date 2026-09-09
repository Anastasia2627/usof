import { pool } from '../config/db.js';
import { Comment } from '../models/Comment.js';
import { Post } from '../models/Post.js';
import { Reaction } from '../models/Reaction.js';
import { AppError } from '../utils/AppError.js';
import {
  deleteReaction,
  recalculateAllRatings,
  setReaction,
} from '../services/reactionService.js';

function positiveInt(value, code = 'INVALID_ID') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(422, code, 'Expected a positive integer');
  }
  return id;
}

async function findPost(postIdValue, user) {
  const postId = positiveInt(postIdValue, 'INVALID_POST_ID');
  const post = await Post.findCoreById(postId);
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  const ownsPost = user && Number(user.sub) === Number(post.author_id);
  if (post.status === 'inactive' && user?.role !== 'admin' && !ownsPost) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  }
  return post;
}

async function findComment(idValue, user, { allowHidden = false } = {}) {
  const id = positiveInt(idValue, 'INVALID_COMMENT_ID');
  const comment = await Comment.findById(id);
  if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  if (allowHidden || user?.role === 'admin') return comment;

  const ownsPost = user && Number(user.sub) === Number(comment.post_author_id);
  if (comment.post_status === 'inactive' && !ownsPost) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }

  const ownsComment = user && Number(user.sub) === Number(comment.author_id);
  if (comment.status === 'inactive' && !ownsComment) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found');
  }
  return comment;
}

export async function listComments(req, res) {
  const where = [];
  const params = [];
  if (req.query.status) {
    if (!['active', 'inactive'].includes(req.query.status)) {
      throw new AppError(422, 'INVALID_STATUS', 'status must be active or inactive');
    }
    where.push('c.status=?');
    params.push(req.query.status);
  }
  if (req.query.post_id) {
    where.push('c.post_id=?');
    params.push(positiveInt(req.query.post_id, 'INVALID_POST_ID'));
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({ data: await Comment.listAdmin({ clause, params }) });
}

export async function listPostComments(req, res) {
  const post = await findPost(req.params.post_id, req.user);
  res.json({ data: await Comment.listForPost(post.id, req.user) });
}

export async function createComment(req, res) {
  const content = String(req.body.content ?? '').trim();
  if (!content) throw new AppError(422, 'VALIDATION_ERROR', 'content is required');
  if (content.length > 20000) {
    throw new AppError(422, 'CONTENT_TOO_LONG', 'content must contain at most 20000 characters');
  }

  const post = await findPost(req.params.post_id, req.user);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && post.status !== 'active') {
    throw new AppError(404, 'POST_NOT_AVAILABLE', 'Active post not found');
  }
  if (!isAdmin && post.locked) {
    throw new AppError(423, 'POST_LOCKED', 'This post is locked');
  }

  let parent = null;
  if (req.body.parentCommentId !== undefined && req.body.parentCommentId !== null) {
    parent = await findComment(req.body.parentCommentId, req.user);
    if (Number(parent.post_id) !== Number(post.id)) {
      throw new AppError(422, 'INVALID_PARENT', 'Parent comment belongs to another post');
    }
    if (!isAdmin && (parent.status !== 'active' || parent.locked)) {
      throw new AppError(423, 'COMMENT_LOCKED', 'This comment cannot receive replies');
    }
  }

  const [result] = await pool.execute(
    "INSERT INTO comments(post_id,author_id,parent_comment_id,content,status,locked) VALUES(?,?,?,?,'active',0)",
    [post.id, Number(req.user.sub), parent?.id || null, content],
  );
  res.status(201).json({
    data: await findComment(result.insertId, req.user, { allowHidden: isAdmin }),
  });
}

export async function getComment(req, res) {
  res.json({ data: await findComment(req.params.comment_id, req.user) });
}

export async function updateComment(req, res) {
  const comment = await findComment(req.params.comment_id, req.user, {
    allowHidden: req.user.role === 'admin',
  });
  const isAdmin = req.user.role === 'admin';
  const isOwner = Number(req.user.sub) === Number(comment.author_id);
  if (!isAdmin && !isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'You can moderate only your own comment');
  }
  if (comment.locked && !isAdmin) {
    throw new AppError(423, 'COMMENT_LOCKED', 'This comment is locked');
  }

  let status = comment.status;
  let locked = Boolean(comment.locked);
  if (req.body.status !== undefined) {
    if (!['active', 'inactive'].includes(req.body.status)) {
      throw new AppError(422, 'INVALID_STATUS', 'status must be active or inactive');
    }
    status = req.body.status;
  }
  if (req.body.locked !== undefined) {
    if (!isAdmin) throw new AppError(403, 'ADMIN_REQUIRED', 'Only admins can lock comments');
    locked = Boolean(req.body.locked);
  }

  await pool.execute(
    'UPDATE comments SET status=?, locked=? WHERE id=?',
    [status, locked ? 1 : 0, comment.id],
  );
  res.json({
    data: await findComment(comment.id, req.user, { allowHidden: isAdmin }),
  });
}

export async function deleteComment(req, res) {
  const comment = await findComment(req.params.comment_id, req.user, {
    allowHidden: req.user.role === 'admin',
  });
  if (req.user.role !== 'admin' && Number(req.user.sub) !== Number(comment.author_id)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete this comment');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM comments WHERE id=?', [comment.id]);
    await recalculateAllRatings(connection);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getCommentReactions(req, res) {
  const comment = await findComment(req.params.comment_id, req.user);
  res.json({ data: await Reaction.listForComment(comment.id) });
}

export async function reactToComment(req, res) {
  const comment = await findComment(req.params.comment_id, req.user, {
    allowHidden: req.user.role === 'admin',
  });
  await setReaction({
    userId: Number(req.user.sub),
    commentId: Number(comment.id),
    type: req.body.type,
    isAdmin: req.user.role === 'admin',
  });
  res.json({
    data: await findComment(comment.id, req.user, {
      allowHidden: req.user.role === 'admin',
    }),
    message: 'Reaction saved',
  });
}

export async function removeCommentReaction(req, res) {
  const comment = await findComment(req.params.comment_id, req.user, {
    allowHidden: req.user.role === 'admin',
  });
  await deleteReaction({
    userId: Number(req.user.sub),
    commentId: Number(comment.id),
    deleteAll: req.user.role === 'admin' && req.query.all === '1',
  });
  res.status(204).end();
}
