import { Router } from 'express';
import { adminDashboard, userDashboard } from '../controllers/dashboardController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, userDashboard);
router.get('/admin', requireAuth, requireAdmin, adminDashboard);

export default router;
