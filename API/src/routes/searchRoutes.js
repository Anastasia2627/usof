import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { search } from '../controllers/searchController.js';

const router = Router();
router.get('/', optionalAuth, search);
export default router;
