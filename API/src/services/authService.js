import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { signAuthToken } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import {
  normalizeEmail,
  normalizeLogin,
  validateEmail,
  validateFullName,
  validateLogin,
  validatePassword,
} from '../utils/validation.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './mailService.js';

function devTokenPayload(key, token) {
  if (process.env.NODE_ENV === 'production') return {};
  return {
    [key]: token,
    note: 'Development mode exposes the token so the flow can be tested without SMTP.',
  };
}

export async function registerAccount(body) {
  const login = normalizeLogin(body.login);
  const email = normalizeEmail(body.email);
  const fullName = validateFullName(body.fullName || '');
  const { password, passwordConfirmation } = body;

  if (!login || !password || !email) {
    throw new AppError(422, 'VALIDATION_ERROR', 'login, password and email are required');
  }
  validateLogin(login);
  validateEmail(email);
  validatePassword(password);
  if (password !== passwordConfirmation) {
    throw new AppError(422, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
  }

  const existing = await User.findByLoginOrEmail(login, email);
  if (existing) throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  try {
    const [result] = await pool.execute(
      `INSERT INTO users(
         login,password_hash,full_name,email,email_verified,
         verification_token,verification_token_expires,role
       ) VALUES(?,?,?,?,0,?,DATE_ADD(NOW(), INTERVAL 24 HOUR),'user')`,
      [login, passwordHash, fullName, email, verificationToken],
    );

    const delivery = await sendVerificationEmail({ to: email, login, token: verificationToken });
    return {
      user: await User.findById(result.insertId),
      emailDelivery: delivery.sent ? 'sent' : delivery.configured ? 'failed' : 'not-configured',
      ...devTokenPayload('verificationToken', verificationToken),
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
    }
    throw error;
  }
}

export async function verifyEmailToken(tokenValue) {
  const token = String(tokenValue || '');
  if (!token) throw new AppError(400, 'INVALID_TOKEN', 'Verification token is invalid');

  const [result] = await pool.execute(
    `UPDATE users
     SET email_verified=1,
         verification_token=NULL,
         verification_token_expires=NULL
     WHERE verification_token=?
       AND verification_token_expires>NOW()`,
    [token],
  );
  if (!result.affectedRows) {
    throw new AppError(400, 'INVALID_TOKEN', 'Verification token is invalid or expired');
  }
}

export async function authenticate(body) {
  const loginValue = normalizeLogin(body.login);
  const email = normalizeEmail(body.email);
  const { password } = body;
  if (!password || (!loginValue && !email)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide login or email and password');
  }

  const user = await User.findByLoginOrEmail(loginValue, email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }
  if (!user.email_verified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Confirm your email before login');
  }

  return { token: signAuthToken(user), user: await User.findById(user.id) };
}

export async function invalidateSession(userId) {
  await pool.execute('UPDATE users SET token_version=token_version+1 WHERE id=?', [Number(userId)]);
}

export async function issuePasswordReset(body) {
  const email = normalizeEmail(body.email);
  if (!email) throw new AppError(422, 'EMAIL_REQUIRED', 'email is required');
  validateEmail(email);

  const genericMessage = 'If that email exists, a reset link has been created';
  const [rows] = await pool.execute('SELECT id, login FROM users WHERE email=?', [email]);
  if (!rows[0]) return { message: genericMessage };

  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const [result] = await pool.execute(
    `UPDATE users
     SET reset_token_hash=?, reset_token_expires=DATE_ADD(NOW(), INTERVAL 30 MINUTE)
     WHERE id=? AND email=?`,
    [hash, rows[0].id, email],
  );
  if (!result.affectedRows) return { message: genericMessage };

  const delivery = await sendPasswordResetEmail({ to: email, token });
  const response = {
    message: genericMessage,
    ...devTokenPayload('resetToken', token),
  };
  if (process.env.NODE_ENV !== 'production') {
    response.emailDelivery = delivery.sent ? 'sent' : delivery.configured ? 'failed' : 'not-configured';
  }
  return response;
}

export async function consumePasswordReset(tokenValue, newPassword) {
  validatePassword(newPassword, 'New password');
  const hash = crypto.createHash('sha256').update(String(tokenValue || '')).digest('hex');
  const [rows] = await pool.execute(
    `SELECT id FROM users
     WHERE reset_token_hash=? AND reset_token_expires>NOW()
     LIMIT 1`,
    [hash],
  );
  if (!rows[0]) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const [result] = await pool.execute(
    `UPDATE users
     SET password_hash=?, reset_token_hash=NULL, reset_token_expires=NULL,
         token_version=token_version+1
     WHERE id=? AND reset_token_hash=? AND reset_token_expires>NOW()`,
    [passwordHash, rows[0].id, hash],
  );
  if (!result.affectedRows) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  }
}
