import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function authSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production');
  }
  return 'development-only-secret-change-me';
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
    'SELECT id, login, role, token_version FROM users WHERE id=? LIMIT 1',
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
  };
}

export async function optionalAuth(req, res, next) {
  try {
    req.user = await resolveUserFromHeader(req.headers.authorization, false);
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await resolveUserFromHeader(req.headers.authorization, true);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(new AppError(403, 'ADMIN_REQUIRED', 'Admin access required'));
  }
  next();
}
