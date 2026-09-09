import { Router } from 'express';
import * as controller from '../controllers/categoriesController.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', controller.listCategories);
router.get('/:category_id', controller.getCategory);
router.get('/:category_id/posts', optionalAuth, controller.postsByCategory);
router.post('/', requireAuth, requireAdmin, controller.createCategory);
router.patch('/:category_id', requireAuth, requireAdmin, controller.updateCategory);
router.delete('/:category_id', requireAuth, requireAdmin, controller.deleteCategory);

export default router;
