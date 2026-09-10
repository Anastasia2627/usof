import { AppError } from './AppError.js';

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
export const normalizeLogin = (value = '') => String(value).trim();

export function positiveInt(value, code = 'INVALID_ID', message = 'Expected a positive integer') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(422, code, message);
  return id;
}

export function validateEmail(email) {
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 190) {
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
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new AppError(422, 'WEAK_PASSWORD', `${field} must contain 8 to 128 characters`);
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
  if (!['user', 'admin'].includes(role)) {
    throw new AppError(422, 'INVALID_ROLE', 'Role must be user or admin');
  }
  return role;
}

export function validateStatus(status) {
  if (!['active', 'inactive'].includes(status)) {
    throw new AppError(422, 'INVALID_STATUS', 'status must be active or inactive');
  }
  return status;
}
