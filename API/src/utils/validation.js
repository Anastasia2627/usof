import { AppError } from './AppError.js';

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
export const normalizeLogin = (value = '') => String(value).trim();

export function positiveInt(value, code = 'INVALID_ID', message = 'Expected a positive integer') {
  // Reject booleans, arrays and objects instead of coercing them to IDs
  if (!(typeof value === 'number' && Number.isSafeInteger(value)) &&
      !(typeof value === 'string' && /^[1-9][0-9]*$/.test(value))) {
    throw new AppError(422, code, message);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(422, code, message);
  return id;
}

export function validateEmail(email) {
  if (typeof email !== 'string' || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(email) || email.length > 190) {
    throw new AppError(422, 'INVALID_EMAIL', 'Invalid email format');
  }
  return email;
}

export function validateLogin(login) {
  if (login.length < 3 || login.length > 50 || !/^[\p{L}\p{N}_.-]+$/u.test(login)) {
    throw new AppError(422, 'INVALID_LOGIN', 'Login must contain 3 to 50 supported characters');
  }
  return login;
}

export function validatePassword(password, field = 'Password') {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new AppError(422, 'WEAK_PASSWORD', `${field} must contain at least 8 characters and at most 72 UTF-8 bytes`);
  }
  return password;
}

export function validateFullName(value = '') {
  const fullName = String(value);
  if (fullName.length > 100) {
    throw new AppError(422, 'INVALID_FULL_NAME', 'Full name must contain at most 100 characters');
  }
  return fullName.trim();
}

export function validateRole(role) {
  if (!['user', 'moderator', 'admin'].includes(role)) {
    throw new AppError(422, 'INVALID_ROLE', 'Role must be user, moderator or admin');
  }
  return role;
}

export function validateStatus(status) {
  if (!['active', 'inactive'].includes(status)) {
    throw new AppError(422, 'INVALID_STATUS', 'status must be active or inactive');
  }
  return status;
}
