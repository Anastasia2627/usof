import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { listReactions, removeReaction } from '../controllers/reactionsAdminController.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/', listReactions);
router.delete('/:reaction_id', removeReaction);
export default router;
