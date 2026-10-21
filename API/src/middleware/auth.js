import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

const UNSAFE_SECRETS = new Set([
  'replace-with-a-long-random-string',
  'development-only-secret-change-me',
  'changeme',
  'your-secret-key',
  'secret',
]);
export function validateAuthConfiguration() {
  const value = String(process.env.AUTH_SECRET || '');
  if (process.env.NODE_ENV === 'production' &&
      (Buffer.byteLength(value, 'utf8') < 32 || UNSAFE_SECRETS.has(value.trim().toLowerCase()))) {
    throw new Error('AUTH_SECRET must be a randomly generated, non-default secret of at least 32 bytes');
  }
}
function authSecret() {
  validateAuthConfiguration();
  return process.env.AUTH_SECRET || 'development-only-secret-change-me';
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: Number(user.id),
      ver: Number(user.token_version || 0),
    },
    authSecret(),
    { expiresIn: process.env.AUTH_TOKEN_TTL || '12h' },
  );
}

async function resolveUserFromHeader(header, strict) {
  if (!header?.startsWith('Bearer ')) {
    if (strict) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), authSecret());
  } catch {
    if (strict) throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    return null;
  }

  const [rows] = await pool.execute(
    'SELECT id, login, role, token_version, banned_at, ban_reason FROM users WHERE id=? LIMIT 1',
    [Number(payload.sub)],
  );
  const user = rows[0];
  if (!user || Number(payload.ver) !== Number(user.token_version)) {
    if (strict) throw new AppError(401, 'INVALID_TOKEN', 'Session is no longer valid');
    return null;
  }

  return {
    sub: Number(user.id),
    login: user.login,
    role: user.role,
    ver: Number(user.token_version),
    banned_at: user.banned_at,
    ban_reason: user.ban_reason,
  };
}

export async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveUserFromHeader(req.headers.authorization, false);
    if (req.user?.banned_at) req.user = null;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await resolveUserFromHeader(req.headers.authorization, true);
    if (req.user.banned_at) {
      throw new AppError(403, 'ACCOUNT_BANNED', 'This account is blocked', {
        banned_at: req.user.banned_at, ban_reason: req.user.ban_reason,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Banned members may access only their ban status, appeal and logout.
export async function requireAppealAuth(req, res, next) {
  try {
    req.user = await resolveUserFromHeader(req.headers.authorization, true);
    next();
  } catch (error) { next(error); }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new AppError(403, 'ADMIN_REQUIRED', 'Admin access required'));
  }
  next();
}

export function requireModerator(req,res,next) {
  if (!['admin','moderator'].includes(req.user?.role))
    return next(new AppError(403,'MODERATOR_REQUIRED','Moderator permission required'));
  next();
}
