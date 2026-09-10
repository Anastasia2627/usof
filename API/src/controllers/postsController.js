import { Reaction } from '../models/Reaction.js';
import { AppError } from '../utils/AppError.js';
import { deleteReaction, setReaction } from '../services/reactionService.js';
import { deliverNotifications, notifyPositiveReaction } from '../services/notificationService.js';
import {
  createPostForUser,
  deletePostForUser,
  getVisiblePost,
  listPostFeed,
  updatePostForUser,
} from '../services/postService.js';

export async function listPosts(req, res) {
  res.json(await listPostFeed(req.query, req.user));
}

export async function getPost(req, res) {
  res.json({ data: await getVisiblePost(req.params.post_id, req.user) });
}

export async function createPost(req, res) {
  res.status(201).json({ data: await createPostForUser(req.user, req.body) });
}

export async function updatePost(req, res) {
  res.json({ data: await updatePostForUser(req.user, req.params.post_id, req.body) });
}

export async function deletePost(req, res) {
  await deletePostForUser(req.user, req.params.post_id);
  res.status(204).end();
}

export async function getPostCategories(req, res) {
  const post = await getVisiblePost(req.params.post_id, req.user);
  res.json({ data: post.categories });
}

export async function getPostReactions(req, res) {
  const post = await getVisiblePost(req.params.post_id, req.user);
  if (post.status !== 'active' && req.user?.role !== 'admin') {
    throw new AppError(404, 'POST_NOT_FOUND', 'Active post not found');
  }
  res.json({ data: await Reaction.listForPost(post.id) });
}

export async function reactToPost(req, res) {
  const post = await getVisiblePost(req.params.post_id, req.user);
  const reaction = await setReaction({
    userId: Number(req.user.sub),
    postId: Number(post.id),
    type: req.body.type,
    isAdmin: req.user.role === 'admin',
  });
  if (reaction.changed) {
    await deliverNotifications([
      () => notifyPositiveReaction({
        targetAuthorId: reaction.targetAuthorId,
        actorId: Number(req.user.sub),
        postId: reaction.postId,
        type: reaction.type,
      }),
    ]);
  }
  res.json({ data: await getVisiblePost(post.id, req.user), message: 'Reaction saved' });
}

export async function removePostReaction(req, res) {
  const post = await getVisiblePost(req.params.post_id, req.user);
  await deleteReaction({
    userId: Number(req.user.sub),
    postId: Number(post.id),
    deleteAll: req.user.role === 'admin' && req.query.all === '1',
  });
  res.status(204).end();
}
