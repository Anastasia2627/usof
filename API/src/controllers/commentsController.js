import { Reaction } from '../models/Reaction.js';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { deleteReaction, setReaction } from '../services/reactionService.js';
import { deliverNotifications, notifyPositiveReaction } from '../services/notificationService.js';
import { assertMayModerateComment, assertMayClearReactions } from '../services/moderationPolicy.js';
import {
  createCommentForUser,
  deleteCommentForUser,
  getVisibleComment,
  listAdminComments,
  listCommentsForPost,
  updateCommentForUser,
} from '../services/commentService.js';

export async function listComments(req, res) {
  res.json({ data: await listAdminComments(req.query,req.user) });
}

export async function listPostComments(req, res) {
  res.json({ data: await listCommentsForPost(req.params.post_id, req.user) });
}

export async function createComment(req, res) {
  res.status(201).json({
    data: await createCommentForUser(req.user, req.params.post_id, req.body),
  });
}

export async function replyToComment(req, res) {
  const parent = await getVisibleComment(req.params.comment_id, req.user);
  res.status(201).json({
    data: await createCommentForUser(req.user, parent.post_id, {
      content: req.body.content,
      parentCommentId: parent.id,
    }),
  });
}

export async function getComment(req, res) {
  const comment=await getVisibleComment(req.params.comment_id, req.user);
  const viewer=req.user;
  const canView=['admin','moderator'].includes(viewer?.role) ||
    comment.status==='active' || Number(viewer?.sub)===Number(comment.author_id) ||
    Number(viewer?.sub)===Number(comment.post_author_id);
  res.json({ data:canView?comment:{
    ...comment,content:'[Comment hidden by moderation]',
  } });
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
    isAdmin: ['admin','moderator'].includes(req.user.role),
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
  if (req.user.role === 'moderator' && req.query.all === '1')
    await assertMayModerateComment(req.user,comment);
  if(req.user.role==='moderator' && req.query.all==='1')
    await assertMayClearReactions(req.user,{commentId:comment.id});
  await deleteReaction({
    userId: Number(req.user.sub),
    commentId: Number(comment.id),
    deleteAll: ['admin','moderator'].includes(req.user.role) && req.query.all === '1',
  });
  res.status(204).end();
}

export async function reviewComment(req,res) {
  if (!['admin','moderator'].includes(req.user.role))
    throw new AppError(403,'MODERATOR_REQUIRED','Moderator permission required');
  if (typeof req.body.reviewed !== 'boolean')
    throw new AppError(422,'INVALID_REVIEW','reviewed must be boolean');
  const comment=await getVisibleComment(req.params.comment_id,req.user);
  const db=await pool.getConnection();
  try {
    await db.beginTransaction();
    const [[freshPost]]=await db.execute(
      'SELECT id,author_id,publish_at FROM posts WHERE id=? FOR UPDATE',
      [comment.post_id],
    );
    const [[freshComment]]=await db.execute(
      'SELECT id,author_id,status FROM comments WHERE id=? AND post_id=? FOR UPDATE',
      [comment.id,comment.post_id],
    );
    if(!freshPost || !freshComment)
      throw new AppError(404,'COMMENT_NOT_FOUND','Comment not found');
    if(freshComment.status!=='active')
      throw new AppError(409,'COMMENT_INACTIVE','Only active replies can be reviewed');
    if(req.user.role==='moderator') {
      const future=Boolean(freshPost.publish_at &&
        new Date(freshPost.publish_at).getTime()>Date.now());
      if(future && Number(req.user.sub)!==Number(freshPost.author_id))
        throw new AppError(404,'COMMENT_NOT_FOUND','Comment not found');
      await assertMayModerateComment(req.user,{
        author_id:freshComment.author_id,
        post_author_id:freshPost.author_id,
      },db);
    }
    await db.execute('UPDATE comments SET reviewed_by=? WHERE id=?',
      [req.body.reviewed ? req.user.sub : null,comment.id]);
    await db.commit();
  }catch(error){await db.rollback();throw error;}
  finally{db.release();}
  res.json({data:await getVisibleComment(comment.id,req.user)});
}
