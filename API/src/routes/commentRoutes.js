import { Router } from 'express';
import * as controller from '../controllers/commentsController.js';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
} from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, controller.listComments);
router.get('/:comment_id', optionalAuth, controller.getComment);
router.get('/:comment_id/like', optionalAuth, controller.getCommentReactions);
router.post('/:comment_id/like', requireAuth, controller.reactToComment);
router.patch('/:comment_id', requireAuth, controller.updateComment);
router.delete('/:comment_id', requireAuth, controller.deleteComment);
router.delete('/:comment_id/like', requireAuth, controller.removeCommentReaction);

export default router;
