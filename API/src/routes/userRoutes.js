import { Router } from 'express';
import * as controller from '../controllers/usersController.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';
import { avatarUpload } from '../middleware/upload.js';
import * as bans from '../controllers/banController.js';

const router = Router();

router.get('/', requireAuth, requireAdmin, controller.listUsers);
router.get('/ban-appeals', requireAuth, requireAdmin, bans.listAppeals);
router.patch('/ban-appeals/:appeal_id', requireAuth, requireAdmin, bans.reviewAppeal);
router.post('/:user_id/ban', requireAuth, requireAdmin, bans.banUser);
router.delete('/:user_id/ban', requireAuth, requireAdmin, bans.unbanUser);
router.get('/:user_id/posts', optionalAuth, controller.listUserPosts);
router.get('/:user_id', optionalAuth, controller.getUser);
router.post('/', requireAuth, requireAdmin, controller.createUser);
router.patch('/avatar', requireAuth, avatarUpload.single('avatar'), controller.uploadAvatar);
router.patch('/:user_id/role',requireAuth,requireAdmin,controller.updateUserRole);
router.patch('/:user_id', requireAuth, controller.updateUser);
router.delete('/:user_id', requireAuth, controller.deleteUser);

export default router;
