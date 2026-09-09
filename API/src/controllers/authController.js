import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { signAuthToken } from '../middleware/auth.js';

const normalizeEmail = (value='') => value.trim().toLowerCase();

export async function register(req, res) {
  const { login, password, passwordConfirmation, email, fullName = '' } = req.body;
  if (!login || !password || !email) throw new AppError(422, 'VALIDATION_ERROR', 'login, password and email are required');
  if (password !== passwordConfirmation) throw new AppError(422, 'PASSWORD_MISMATCH', 'Password confirmation does not match');
  if (password.length < 8) throw new AppError(422, 'WEAK_PASSWORD', 'Password must contain at least 8 characters');
  const cleanEmail = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new AppError(422, 'INVALID_EMAIL', 'Invalid email format');
  const existing = await User.findByLoginOrEmail(login, cleanEmail);
  if (existing) throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
  const hash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(24).toString('hex');
  const [result] = await pool.execute('INSERT INTO users(login,password_hash,full_name,email,email_verified,verification_token,role) VALUES(?,?,?,?,0,?,\'user\')', [login.trim(), hash, fullName.trim(), cleanEmail, verificationToken]);
  res.status(201).json({ user: await User.findById(result.insertId), verificationToken, note: 'Development mode: use the token with /api/auth/verify-email/:token.' });
}

export async function verifyEmail(req, res) {
  const [result] = await pool.execute('UPDATE users SET email_verified=1, verification_token=NULL WHERE verification_token=?', [req.params.token]);
  if (!result.affectedRows) throw new AppError(404, 'INVALID_TOKEN', 'Verification token is invalid');
  res.json({ message: 'Email verified' });
}

export async function login(req, res) {
  const { login: loginValue = '', email = '', password } = req.body;
  if (!password || (!loginValue && !email)) throw new AppError(422, 'VALIDATION_ERROR', 'Provide login or email and password');
  const user = await User.findByLoginOrEmail(loginValue, normalizeEmail(email));
  if (!user || !(await bcrypt.compare(password, user.password_hash))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  if (!user.email_verified) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Confirm your email before login');
  res.json({ token: signAuthToken(user), user: await User.findById(user.id) });
}

export async function logout(req, res) { res.status(204).end(); }

export async function requestPasswordReset(req, res) {
  const email = normalizeEmail(req.body.email);
  const [rows] = await pool.execute('SELECT id FROM users WHERE email=?', [email]);
  if (rows[0]) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.execute('UPDATE users SET reset_token_hash=?, reset_token_expires=DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id=?', [hash, rows[0].id]);
    return res.json({ message: 'Reset token generated', resetToken: token, note: 'Development mode token. Configure SMTP for real email delivery.' });
  }
  res.json({ message: 'If that email exists, a reset link has been created' });
}

export async function confirmPasswordReset(req, res) {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) throw new AppError(422, 'WEAK_PASSWORD', 'New password must contain at least 8 characters');
  const hash = crypto.createHash('sha256').update(req.params.confirm_token).digest('hex');
  const [rows] = await pool.execute('SELECT id FROM users WHERE reset_token_hash=? AND reset_token_expires>NOW()', [hash]);
  if (!rows[0]) throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE users SET password_hash=?, reset_token_hash=NULL, reset_token_expires=NULL WHERE id=?', [passwordHash, rows[0].id]);
  res.json({ message: 'Password changed' });
}
