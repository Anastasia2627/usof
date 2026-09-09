import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

const secret = () => process.env.AUTH_SECRET || 'development-only-secret-change-me';

export function signAuthToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, login: user.login }, secret(), { expiresIn: '12h' });
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), secret());
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError(401, 'AUTH_REQUIRED', 'Authentication required'));
  try {
    req.user = jwt.verify(header.slice(7), secret());
    next();
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(new AppError(403, 'ADMIN_REQUIRED', 'Admin access required'));
  next();
}
