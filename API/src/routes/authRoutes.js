import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { requireAppealAuth, requireAuth } from '../middleware/auth.js';
import * as bans from '../controllers/banController.js';

const router = Router();

router.post('/register', controller.register);
router.post('/resend-verification', controller.resendVerification);
router.post('/verify-email-code', controller.verifyEmailWithCode);
router.post('/verify-email/:token', controller.verifyEmail);
router.post('/login', controller.login);
router.post('/google', controller.googleLogin);
router.post('/logout', requireAppealAuth, controller.logout);
router.get('/ban-status', requireAppealAuth, bans.banStatus);
router.post('/ban-appeal', requireAppealAuth, bans.submitAppeal);
router.post('/password-reset', controller.requestPasswordReset);
router.post('/password-reset/:confirm_token', controller.confirmPasswordReset);

export default router;
