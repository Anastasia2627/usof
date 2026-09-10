import { Engagement } from '../models/Engagement.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { getVisiblePost } from '../services/postService.js';

const SHARE_CHANNELS = ['native', 'copy', 'facebook', 'x', 'telegram', 'other'];

function postId(value) {
  return positiveInt(value, 'INVALID_POST_ID', 'Post id must be a positive integer');
}

async function requireActivePost(id, user) {
  const post = await getVisiblePost(id, user);
  if (post.status !== 'active' && user?.role !== 'admin') {
    throw new AppError(404, 'POST_NOT_FOUND', 'Active post not found');
  }
  return post;
}

export async function getPostEngagement(req, res) {
  const id = postId(req.params.post_id);
  await getVisiblePost(id, req.user);
  const [favorite, following] = await Promise.all([
    Engagement.favoriteState(Number(req.user.sub), id),
    Engagement.followState(Number(req.user.sub), id),
  ]);
  res.json({ data: { favorite, following } });
}

export async function savePost(req, res) {
  const id = postId(req.params.post_id);
  await requireActivePost(id, req.user);
  await Engagement.savePost(Number(req.user.sub), id);
  res.status(201).json({ data: { favorite: true } });
}

export async function unsavePost(req, res) {
  const id = postId(req.params.post_id);
  await getVisiblePost(id, req.user);
  await Engagement.unsavePost(Number(req.user.sub), id);
  res.status(204).end();
}

export async function followPost(req, res) {
  const id = postId(req.params.post_id);
  await requireActivePost(id, req.user);
  await Engagement.followPost(Number(req.user.sub), id);
  res.status(201).json({ data: { following: true } });
}

export async function unfollowPost(req, res) {
  const id = postId(req.params.post_id);
  await getVisiblePost(id, req.user);
  await Engagement.unfollowPost(Number(req.user.sub), id);
  res.status(204).end();
}

function listOptions(query) {
  return {
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    order: query.order,
  };
}

export async function listFavorites(req, res) {
  res.json(await Engagement.listFavorites(Number(req.user.sub), listOptions(req.query)));
}

export async function listFollowing(req, res) {
  res.json(await Engagement.listFollowing(Number(req.user.sub), listOptions(req.query)));
}

export async function recordShare(req, res) {
  const id = postId(req.params.post_id);
  await requireActivePost(id, req.user);
  const channel = String(req.body?.channel || 'other').toLowerCase();
  if (!SHARE_CHANNELS.includes(channel)) {
    throw new AppError(
      422,
      'INVALID_SHARE_CHANNEL',
      `channel must be one of: ${SHARE_CHANNELS.join(', ')}`,
    );
  }
  await Engagement.recordShare(id, req.user ? Number(req.user.sub) : null, channel);
  res.status(201).json({ data: { shareCount: await Engagement.shareCount(id) } });
}
