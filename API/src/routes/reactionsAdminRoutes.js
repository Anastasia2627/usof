import { Router } from 'express';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { listReactions, removeReaction } from '../controllers/reactionsAdminController.js';

const router = Router();
router.use(requireAuth, requireModerator);
router.get('/', listReactions);
router.delete('/:reaction_id', removeReaction);
export default router;
