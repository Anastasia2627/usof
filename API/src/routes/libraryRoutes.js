import { Router } from 'express';
import { listFavorites, listFollowing } from '../controllers/engagementController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/favorites', listFavorites);
router.get('/following', listFollowing);

export default router;
