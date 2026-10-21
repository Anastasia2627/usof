import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { requireAppealAuth, requireAuth } from '../middleware/auth.js';
import * as bans from '../controllers/banController.js';

const router = Router();

// Conservative single-process throttle. Behind a cluster/load balancer,
// replace this with a shared Redis/edge limit for all API instances.
const attempts = new Map();
function authThrottle({ max, windowMs }) {
  return (req,res,next) => {
    const now = Date.now();
    // Express req.ip respects trust-proxy configuration; this app does not
    // trust arbitrary forwarded IP headers by default
    const key = req.path + ':' + req.ip;
    const entry = attempts.get(key);
    if (attempts.size > 10000) {
      for (const [name,item] of attempts) {
        if (now >= item.resetAt) attempts.delete(name);
      }
    }
    const current = !entry || now >= entry.resetAt
      ? { count: 0, resetAt: now + windowMs } : entry;
    current.count += 1;
    attempts.set(key,current);
    if (current.count > max) {
      res.set('Retry-After', String(Math.max(1,Math.ceil((current.resetAt-now)/1000))));
      return res.status(429).json({ code:'RATE_LIMITED',
        message:'Too many attempts, try again later' });
    }
    return next();
  };
}


router.post('/register', authThrottle({ max: 6, windowMs: 15 * 60_000 }), controller.register);
router.post('/resend-verification', authThrottle({ max: 5, windowMs: 15 * 60_000 }), controller.resendVerification);
router.post('/verify-email-code', authThrottle({ max: 15, windowMs: 15 * 60_000 }), controller.verifyEmailWithCode);
router.post('/verify-email/:token', controller.verifyEmail);
router.post('/login', authThrottle({ max: 20, windowMs: 15 * 60_000 }), controller.login);
router.post('/google', authThrottle({ max: 25, windowMs: 15 * 60_000 }), controller.googleLogin);
router.post('/logout', requireAppealAuth, controller.logout);
router.get('/ban-status', requireAppealAuth, bans.banStatus);
router.post('/ban-appeal', requireAppealAuth, bans.submitAppeal);
router.post('/password-reset', authThrottle({ max: 5, windowMs: 15 * 60_000 }), controller.requestPasswordReset);
router.post('/password-reset/:confirm_token', controller.confirmPasswordReset);

export default router;
