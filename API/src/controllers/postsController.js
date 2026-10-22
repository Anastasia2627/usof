import { Reaction } from '../models/Reaction.js';
import { AppError } from '../utils/AppError.js';
import { deleteReaction, setReaction } from '../services/reactionService.js';

import { assertMayModerateAuthors, assertMayClearReactions } from '../services/moderationPolicy.js';
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
  if (post.status !== 'active' && !['admin','moderator'].includes(req.user?.role)) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Active post not found');
  }
  const items = await Reaction.listForPost(post.id);
  const canInspect = ['admin','moderator'].includes(req.user?.role) || Number(req.user?.sub) === Number(post.author_id);
  res.json({ data: post.hide_likes && !canInspect
    ? items.filter(item => Number(item.author_id) === Number(req.user?.sub))
    : items });
}

export async function reactToPost(req, res) {
  const post = await getVisiblePost(req.params.post_id, req.user);
  const reaction = await setReaction({
    userId: Number(req.user.sub),
    postId: Number(post.id),
    type: req.body.type,
    isAdmin: ['admin','moderator'].includes(req.user.role),
  });
  res.json({ data: await getVisiblePost(post.id, req.user), message: 'Reaction saved' });
}

export async function removePostReaction(req, res) {
  const post = await getVisiblePost(req.params.post_id, req.user);
  if (req.user.role === 'moderator' && req.query.all === '1')
    await assertMayModerateAuthors(req.user,[post.author_id]);
  if(req.user.role==='moderator' && req.query.all==='1')
    await assertMayClearReactions(req.user,{postId:post.id});
  await deleteReaction({
    userId: Number(req.user.sub),
    postId: Number(post.id),
    deleteAll: ['admin','moderator'].includes(req.user.role) && req.query.all === '1',
  });
  res.status(204).end();
}
