import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import {
  normalizeEmail,
  normalizeLogin,
  positiveInt,
  validateEmail,
  validateFullName,
  validateLogin,
  validatePassword,
  validateRole,
} from '../utils/validation.js';
import { sendVerificationEmail } from './mailService.js';
import { recalculateAllRatings } from './reactionService.js';

async function lockAdmins(connection) {
  const [rows] = await connection.query(
    "SELECT id FROM users WHERE role='admin' ORDER BY id FOR UPDATE",
  );
  return rows.map((row) => Number(row.id));
}

function protectLastAdmin(adminIds, current, nextRole = current.role) {
  if (current.role !== 'admin' || nextRole === 'admin') return;
  if (adminIds.length <= 1 && adminIds.includes(Number(current.id))) {
    throw new AppError(409, 'LAST_ADMIN_REQUIRED', 'The system must keep at least one administrator');
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    login: row.login,
    full_name: row.full_name,
    email: row.email,
    email_verified: row.email_verified,
    avatar: row.avatar,
    rating: row.rating,
    role: row.role,
    created_at: row.created_at,
  };
}

export async function createManagedUser(body) {
  const login = normalizeLogin(body.login);
  const email = normalizeEmail(body.email);
  const fullName = validateFullName(body.fullName || '');
  const role = body.role;

  validateLogin(login);
  validateEmail(email);
  validatePassword(body.password);
  if (body.password !== body.passwordConfirmation) {
    throw new AppError(422, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
  }
  if (role === undefined) {
    throw new AppError(422, 'ROLE_REQUIRED', 'role is required when an admin creates an account');
  }
  validateRole(role);

  const hash = await bcrypt.hash(body.password, 12);
  try {
    const [result] = await pool.execute(
      `INSERT INTO users(login,password_hash,full_name,email,email_verified,role)
       VALUES(?,?,?,?,1,?)`,
      [login, hash, fullName, email, role],
    );
    return User.findById(result.insertId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
    }
    throw error;
  }
}

export async function updateAccount({ targetId, actor, body }) {
  const id = positiveInt(targetId, 'INVALID_USER_ID', 'Invalid user id');
  const isAdmin = actor.role === 'admin';
  if (!isAdmin && Number(actor.sub) !== id) {
    throw new AppError(403, 'FORBIDDEN', 'You can update only your profile');
  }

  const connection = await pool.getConnection();
  let updated;
  let invalidateSession = false;
  let verificationToken = null;
  try {
    await connection.beginTransaction();
    const adminIds = isAdmin ? await lockAdmins(connection) : [];
    const [[current]] = await connection.execute('SELECT * FROM users WHERE id=? FOR UPDATE', [id]);
    if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const fullName = validateFullName(body.fullName ?? current.full_name);
    let login = current.login;
    let email = current.email;
    let role = current.role;

    if (isAdmin) {
      if (body.login !== undefined) {
        login = normalizeLogin(body.login);
        validateLogin(login);
      }
      if (body.email !== undefined) {
        email = normalizeEmail(body.email);
        validateEmail(email);
      }
      if (body.role !== undefined) role = validateRole(body.role);
    } else if (body.login !== undefined || body.email !== undefined || body.role !== undefined) {
      throw new AppError(
        403,
        'FIELD_FORBIDDEN',
        'Regular users can update fullName here; avatar has a separate endpoint',
      );
    }

    protectLastAdmin(adminIds, current, role);

    const emailChanged = email !== current.email;
    invalidateSession = emailChanged || role !== current.role || login !== current.login;
    const needsVerification = emailChanged || (body.email !== undefined && !current.email_verified);
    verificationToken = needsVerification ? crypto.randomBytes(32).toString('hex') : null;

    await connection.execute(
      `UPDATE users
       SET login=?, full_name=?, email=?, role=?,
           token_version=token_version+?,
           email_verified=IF(?,0,email_verified),
           verification_token=IF(?,?,verification_token),
           verification_token_expires=IF(?,DATE_ADD(NOW(), INTERVAL 24 HOUR),verification_token_expires),
           reset_token_hash=IF(?,NULL,reset_token_hash),
           reset_token_expires=IF(?,NULL,reset_token_expires)
       WHERE id=?`,
      [
        login,
        fullName,
        email,
        role,
        invalidateSession ? 1 : 0,
        emailChanged,
        needsVerification,
        verificationToken,
        needsVerification,
        emailChanged,
        emailChanged,
        id,
      ],
    );

    const [[row]] = await connection.execute('SELECT * FROM users WHERE id=?', [id]);
    updated = publicUser(row);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
    }
    throw error;
  } finally {
    connection.release();
  }

  const result = { data: updated, sessionInvalidated: invalidateSession };
  if (verificationToken) {
    const delivery = await sendVerificationEmail({
      to: updated.email,
      login: updated.login,
      token: verificationToken,
    });
    result.emailDelivery = delivery.sent ? 'sent' : delivery.configured ? 'failed' : 'not-configured';
    if (process.env.NODE_ENV !== 'production') result.verificationToken = verificationToken;
  }
  return result;
}

export async function deleteAccount({ targetId, actor }) {
  const id = positiveInt(targetId, 'INVALID_USER_ID', 'Invalid user id');
  if (actor.role !== 'admin' && Number(actor.sub) !== id) {
    throw new AppError(403, 'FORBIDDEN', 'You can delete only your profile');
  }

  const connection = await pool.getConnection();
  let avatar = null;
  try {
    await connection.beginTransaction();
    const adminIds = actor.role === 'admin' ? await lockAdmins(connection) : [];
    const [[current]] = await connection.execute('SELECT * FROM users WHERE id=? FOR UPDATE', [id]);
    if (!current) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    protectLastAdmin(adminIds, current, '__deleted__');
    avatar = current.avatar;
    await connection.query('DELETE FROM users WHERE id=?', [id]);
    await recalculateAllRatings(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (avatar?.startsWith('/uploads/avatars/')) {
    await fs.unlink(path.resolve('API/uploads/avatars', path.basename(avatar))).catch(() => {});
  }
}
