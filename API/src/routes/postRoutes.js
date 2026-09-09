import { Router } from 'express';
import { createComment, listPostComments } from '../controllers/commentsController.js';
import * as controller from '../controllers/postsController.js';
import {
  followPost,
  getPostEngagement,
  recordShare,
  savePost,
  unfollowPost,
  unsavePost,
} from '../controllers/engagementController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, controller.listPosts);
router.get('/:post_id', optionalAuth, controller.getPost);
router.get('/:post_id/comments', optionalAuth, listPostComments);
router.post('/:post_id/comments', requireAuth, createComment);
router.get('/:post_id/categories', optionalAuth, controller.getPostCategories);
router.get('/:post_id/like', optionalAuth, controller.getPostReactions);
router.get('/:post_id/engagement', requireAuth, getPostEngagement);
router.post('/:post_id/favorite', requireAuth, savePost);
router.delete('/:post_id/favorite', requireAuth, unsavePost);
router.post('/:post_id/follow', requireAuth, followPost);
router.delete('/:post_id/follow', requireAuth, unfollowPost);
router.post('/:post_id/share', optionalAuth, recordShare);
router.post('/', requireAuth, controller.createPost);
router.post('/:post_id/like', requireAuth, controller.reactToPost);
router.patch('/:post_id', requireAuth, controller.updatePost);
router.delete('/:post_id', requireAuth, controller.deletePost);
router.delete('/:post_id/like', requireAuth, controller.removePostReaction);

export default router;
