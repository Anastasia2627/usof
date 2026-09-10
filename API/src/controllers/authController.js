import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { signAuthToken } from '../middleware/auth.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/mailService.js';

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const normalizeLogin = (value = '') => String(value).trim();

function validateEmail(email) {
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 190) {
    throw new AppError(422, 'INVALID_EMAIL', 'Invalid email format');
  }
}

function validateLogin(login) {
  if (login.length < 3 || login.length > 50) {
    throw new AppError(422, 'INVALID_LOGIN', 'Login must contain 3 to 50 characters');
  }
  if (!/^[\p{L}\p{N}_.-]+$/u.test(login)) {
    throw new AppError(422, 'INVALID_LOGIN', 'Login contains unsupported characters');
  }
}

function validatePassword(password, field = 'Password') {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new AppError(422, 'WEAK_PASSWORD', `${field} must contain 8 to 128 characters`);
  }
}

function devTokenPayload(key, token) {
  if (process.env.NODE_ENV === 'production') return {};
  return {
    [key]: token,
    note: 'Development mode exposes the token so the flow can be tested without SMTP.',
  };
}

export async function register(req, res) {
  const { password, passwordConfirmation, fullName = '' } = req.body;
  const login = normalizeLogin(req.body.login);
  const email = normalizeEmail(req.body.email);

  if (!login || !password || !email) {
    throw new AppError(422, 'VALIDATION_ERROR', 'login, password and email are required');
  }
  validateLogin(login);
  validateEmail(email);
  validatePassword(password);
  if (password !== passwordConfirmation) {
    throw new AppError(422, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
  }
  if (String(fullName).length > 100) {
    throw new AppError(422, 'INVALID_FULL_NAME', 'Full name must contain at most 100 characters');
  }

  const existing = await User.findByLoginOrEmail(login, email);
  if (existing) throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const [result] = await pool.execute(
    `INSERT INTO users(
       login,password_hash,full_name,email,email_verified,
       verification_token,verification_token_expires,role
     ) VALUES(?,?,?,?,0,?,DATE_ADD(NOW(), INTERVAL 24 HOUR),'user')`,
    [login, passwordHash, String(fullName).trim(), email, verificationToken],
  );

  const delivery = await sendVerificationEmail({ to: email, login, token: verificationToken });
  res.status(201).json({
    user: await User.findById(result.insertId),
    emailDelivery: delivery.sent ? 'sent' : delivery.configured ? 'failed' : 'not-configured',
    ...devTokenPayload('verificationToken', verificationToken),
  });
}

export async function verifyEmail(req, res) {
  const token = String(req.params.token || '');
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
  res.json({ message: 'Email verified' });
}

export async function login(req, res) {
  const loginValue = normalizeLogin(req.body.login);
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
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

  res.json({ token: signAuthToken(user), user: await User.findById(user.id) });
}

export async function logout(req, res) {
  await pool.execute('UPDATE users SET token_version=token_version+1 WHERE id=?', [Number(req.user.sub)]);
  res.status(204).end();
}

export async function requestPasswordReset(req, res) {
  const email = normalizeEmail(req.body.email);
  if (!email) throw new AppError(422, 'EMAIL_REQUIRED', 'email is required');
  validateEmail(email);

  const genericMessage = 'If that email exists, a reset link has been created';
  const [rows] = await pool.execute('SELECT id, login FROM users WHERE email=?', [email]);
  if (!rows[0]) {
    return res.json({ message: genericMessage });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.execute(
    `UPDATE users
     SET reset_token_hash=?, reset_token_expires=DATE_ADD(NOW(), INTERVAL 30 MINUTE)
     WHERE id=?`,
    [hash, rows[0].id],
  );

  const delivery = await sendPasswordResetEmail({ to: email, token });
  const response = {
    message: genericMessage,
    ...devTokenPayload('resetToken', token),
  };
  if (process.env.NODE_ENV !== 'production') {
    response.emailDelivery = delivery.sent ? 'sent' : delivery.configured ? 'failed' : 'not-configured';
  }
  res.json(response);
}

export async function confirmPasswordReset(req, res) {
  const { newPassword } = req.body;
  validatePassword(newPassword, 'New password');
  const hash = crypto.createHash('sha256').update(String(req.params.confirm_token || '')).digest('hex');
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
  // Hashing takes time: another request may have consumed or replaced the token.
  if (!result.affectedRows) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  }
  res.json({ message: 'Password changed' });
}
