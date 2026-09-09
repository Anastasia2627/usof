import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
const r=Router();
r.post('/register',c.register);r.post('/verify-email/:token',c.verifyEmail);r.post('/login',c.login);r.post('/logout',requireAuth,c.logout);r.post('/password-reset',c.requestPasswordReset);r.post('/password-reset/:confirm_token',c.confirmPasswordReset);
export default r;
