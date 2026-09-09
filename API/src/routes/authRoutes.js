import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', controller.register);
router.post('/verify-email/:token', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/logout', requireAuth, controller.logout);
router.post('/password-reset', controller.requestPasswordReset);
router.post('/password-reset/:confirm_token', controller.confirmPasswordReset);

export default router;
