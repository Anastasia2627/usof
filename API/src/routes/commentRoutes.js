import { Router } from 'express';
import * as controller from '../controllers/commentsController.js';
import {
  optionalAuth,
  requireModerator,
  requireAuth,
} from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireModerator, controller.listComments);
router.get('/:comment_id', optionalAuth, controller.getComment);
router.post('/:comment_id/replies', requireAuth, controller.replyToComment);
router.get('/:comment_id/like', optionalAuth, controller.getCommentReactions);
router.post('/:comment_id/like', requireAuth, controller.reactToComment);
router.patch('/:comment_id/review', requireAuth, controller.reviewComment);
router.patch('/:comment_id', requireAuth, controller.updateComment);
router.delete('/:comment_id', requireAuth, controller.deleteComment);
router.delete('/:comment_id/like', requireAuth, controller.removeCommentReaction);

export default router;
