import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recalculateAllRatings } from '../services/reactionService.js';

function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeLogin(value = '') {
  return String(value).trim();
}

function validateEmail(email) {
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 190) {
    throw new AppError(422, 'INVALID_EMAIL', 'Invalid email format');
  }
}

function validateLogin(login) {
  if (login.length < 3 || login.length > 50 || !/^[\p{L}\p{N}_.-]+$/u.test(login)) {
    throw new AppError(422, 'INVALID_LOGIN', 'Login must contain 3 to 50 supported characters');
  }
}

function validateId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(422, 'INVALID_USER_ID', 'Invalid user id');
  }
  return id;
}

export async function listUsers(req, res) {
  res.json({ data: await User.list() });
}

export async function getUser(req, res) {
  const user = await User.findById(validateId(req.params.user_id));
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  res.json({ data: user });
}

export async function createUser(req, res) {
  const login = normalizeLogin(req.body.login);
  const email = normalizeEmail(req.body.email);
  const {
    password,
    passwordConfirmation,
    role = 'user',
    fullName = '',
  } = req.body;

  validateLogin(login);
  validateEmail(email);
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new AppError(422, 'WEAK_PASSWORD', 'Password must contain 8 to 128 characters');
  }
  if (password !== passwordConfirmation) {
    throw new AppError(422, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
  }
  if (!['user', 'admin'].includes(role)) {
    throw new AppError(422, 'INVALID_ROLE', 'Role must be user or admin');
  }
  if (String(fullName).length > 100) {
    throw new AppError(422, 'INVALID_FULL_NAME', 'Full name must contain at most 100 characters');
  }

  const hash = await bcrypt.hash(password, 12);
  try {
    const [result] = await pool.execute(
      `INSERT INTO users(login,password_hash,full_name,email,email_verified,role)
       VALUES(?,?,?,?,1,?)`,
      [login, hash, String(fullName).trim(), email, role],
    );
    res.status(201).json({ data: await User.findById(result.insertId) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
    }
    throw error;
  }
}

export async function updateUser(req, res) {
  const id = validateId(req.params.user_id);
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && Number(req.user.sub) !== id) {
    throw new AppError(403, 'FORBIDDEN', 'You can update only your profile');
  }

  const current = await User.findById(id);
  if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const fullName = req.body.fullName ?? current.full_name;
  if (String(fullName).length > 100) {
    throw new AppError(422, 'INVALID_FULL_NAME', 'Full name must contain at most 100 characters');
  }

  let login = current.login;
  let email = current.email;
  let role = current.role;
  if (isAdmin) {
    if (req.body.login !== undefined) {
      login = normalizeLogin(req.body.login);
      validateLogin(login);
    }
    if (req.body.email !== undefined) {
      email = normalizeEmail(req.body.email);
      validateEmail(email);
    }
    if (req.body.role !== undefined) {
      if (!['user', 'admin'].includes(req.body.role)) {
        throw new AppError(422, 'INVALID_ROLE', 'Role must be user or admin');
      }
      role = req.body.role;
    }
  } else if (
    req.body.login !== undefined ||
    req.body.email !== undefined ||
    req.body.role !== undefined
  ) {
    throw new AppError(
      403,
      'FIELD_FORBIDDEN',
      'Regular users can update fullName here; avatar has a separate endpoint',
    );
  }

  const invalidateSession = role !== current.role || login !== current.login;
  try {
    await pool.execute(
      `UPDATE users
       SET login=?, full_name=?, email=?, role=?,
           token_version=token_version+?
       WHERE id=?`,
      [login, String(fullName).trim(), email, role, invalidateSession ? 1 : 0, id],
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
    }
    throw error;
  }

  res.json({ data: await User.findById(id), sessionInvalidated: invalidateSession });
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw new AppError(422, 'FILE_REQUIRED', 'Avatar file is required');
  const user = await User.findById(Number(req.user.sub));
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const avatar = `/uploads/avatars/${req.file.filename}`;
  await pool.execute('UPDATE users SET avatar=? WHERE id=?', [avatar, Number(req.user.sub)]);

  if (user.avatar?.startsWith('/uploads/avatars/')) {
    const oldName = path.basename(user.avatar);
    if (oldName !== req.file.filename) {
      await fs.unlink(path.resolve('API/uploads/avatars', oldName)).catch(() => {});
    }
  }

  res.json({ data: await User.findById(Number(req.user.sub)) });
}

export async function deleteUser(req, res) {
  const id = validateId(req.params.user_id);
  if (req.user.role !== 'admin' && Number(req.user.sub) !== id) {
    throw new AppError(403, 'FORBIDDEN', 'You can delete only your profile');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('DELETE FROM users WHERE id=?', [id]);
    if (!result.affectedRows) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }
    await recalculateAllRatings(connection);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
