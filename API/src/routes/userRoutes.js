import { Router } from 'express';
import * as controller from '../controllers/usersController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { avatarUpload } from '../middleware/upload.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, controller.listUsers);
router.get('/:user_id', requireAuth, controller.getUser);
router.post('/', requireAuth, requireAdmin, controller.createUser);
router.patch('/avatar', requireAuth, avatarUpload.single('avatar'), controller.uploadAvatar);
router.patch('/:user_id', requireAuth, controller.updateUser);
router.delete('/:user_id', requireAuth, controller.deleteUser);

export default router;
