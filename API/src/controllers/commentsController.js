import { Reaction } from '../models/Reaction.js';
import { deleteReaction, setReaction } from '../services/reactionService.js';
import { deliverNotifications, notifyPositiveReaction } from '../services/notificationService.js';
import {
  createCommentForUser,
  deleteCommentForUser,
  getVisibleComment,
  listAdminComments,
  listCommentsForPost,
  updateCommentForUser,
} from '../services/commentService.js';

export async function listComments(req, res) {
  res.json({ data: await listAdminComments(req.query) });
}

export async function listPostComments(req, res) {
  res.json({ data: await listCommentsForPost(req.params.post_id, req.user) });
}

export async function createComment(req, res) {
  res.status(201).json({
    data: await createCommentForUser(req.user, req.params.post_id, req.body),
  });
}

export async function getComment(req, res) {
  res.json({ data: await getVisibleComment(req.params.comment_id, req.user) });
}

export async function updateComment(req, res) {
  res.json({
    data: await updateCommentForUser(req.user, req.params.comment_id, req.body),
  });
}

export async function deleteComment(req, res) {
  await deleteCommentForUser(req.user, req.params.comment_id);
  res.status(204).end();
}

export async function getCommentReactions(req, res) {
  const comment = await getVisibleComment(req.params.comment_id, req.user, {
    requireActiveComment: true,
    requireActivePost: true,
  });
  res.json({ data: await Reaction.listForComment(comment.id) });
}

export async function reactToComment(req, res) {
  const comment = await getVisibleComment(req.params.comment_id, req.user);
  const reaction = await setReaction({
    userId: Number(req.user.sub),
    commentId: Number(comment.id),
    type: req.body.type,
    isAdmin: req.user.role === 'admin',
  });
  if (reaction.changed) {
    await deliverNotifications([
      () => notifyPositiveReaction({
        targetAuthorId: reaction.targetAuthorId,
        actorId: Number(req.user.sub),
        postId: reaction.postId,
        commentId: reaction.commentId,
        type: reaction.type,
      }),
    ]);
  }
  res.json({
    data: await getVisibleComment(comment.id, req.user),
    message: 'Reaction saved',
  });
}

export async function removeCommentReaction(req, res) {
  const comment = await getVisibleComment(req.params.comment_id, req.user);
  await deleteReaction({
    userId: Number(req.user.sub),
    commentId: Number(comment.id),
    deleteAll: req.user.role === 'admin' && req.query.all === '1',
  });
  res.status(204).end();
}
