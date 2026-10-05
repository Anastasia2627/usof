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

function devTokenPayload(values) {
  if (process.env.NODE_ENV === 'production') return {};
  return {
    ...values,
    note: 'Development mode exposes verification credentials so the flow can be tested without SMTP.',
  };
}

function hashVerificationCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function createVerificationCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
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
  const verificationCode = createVerificationCode();
  const verificationCodeHash = hashVerificationCode(verificationCode);

  try {
    const [result] = await pool.execute(
      `INSERT INTO users(
         login,password_hash,full_name,email,email_verified,
         verification_token,verification_token_expires,
         verification_code_hash,verification_code_expires,role
       ) VALUES(?,?,?,?,0,?,DATE_ADD(NOW(), INTERVAL 20 MINUTE),?,DATE_ADD(NOW(), INTERVAL 20 MINUTE),'user')`,
      [login, passwordHash, fullName, email, verificationToken, verificationCodeHash],
    );

    const delivery = await sendVerificationEmail({
      to: email,
      login,
      token: verificationToken,
      code: verificationCode,
    });

    return {
      user: await User.findById(result.insertId),
      emailDelivery: delivery.sent ? 'sent' : delivery.configured ? 'failed' : 'not-configured',
      ...devTokenPayload({
        verificationToken,
        verificationCode,
      }),
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'USER_EXISTS', 'Login or email is already used');
    }
    throw error;
  }
}

export async function verifyEmailToken(tokenValue) {
  const token = String(tokenValue || '').trim();
  if (!token) throw new AppError(400, 'INVALID_TOKEN', 'Verification token is invalid');

  const [result] = await pool.execute(
    `UPDATE users
     SET email_verified=1,
         verification_token=NULL,
         verification_token_expires=NULL,
         verification_code_hash=NULL,
         verification_code_expires=NULL
     WHERE email_verified=0
       AND verification_token=?
       AND verification_token_expires>NOW()`,
    [token],
  );

  if (!result.affectedRows) {
    throw new AppError(400, 'INVALID_TOKEN', 'Verification link is invalid, expired, or already used');
  }
}

export async function verifyEmailCode(body) {
  const email = normalizeEmail(body.email);
  const code = String(body.code || '').replace(/\D/g, '');

  if (!email || !/^\d{6}$/.test(code)) {
    throw new AppError(422, 'INVALID_VERIFICATION_CODE', 'Provide a valid email and 6-digit code');
  }
  validateEmail(email);

  const codeHash = hashVerificationCode(code);
  const [result] = await pool.execute(
    `UPDATE users
     SET email_verified=1,
         verification_token=NULL,
         verification_token_expires=NULL,
         verification_code_hash=NULL,
         verification_code_expires=NULL
     WHERE email_verified=0
       AND email=?
       AND verification_code_hash=?
       AND verification_code_expires>NOW()`,
    [email, codeHash],
  );

  if (!result.affectedRows) {
    throw new AppError(400, 'INVALID_VERIFICATION_CODE', 'Verification code is invalid, expired, or already used');
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
    ...devTokenPayload({ resetToken: token }),
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


async function fetchGoogleProfile(credential) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new AppError(503, 'GOOGLE_AUTH_NOT_CONFIGURED', 'Google sign-in is not configured');
  }
  if (!credential) {
    throw new AppError(422, 'GOOGLE_CREDENTIAL_REQUIRED', 'Google credential is required');
  }

  let response;
  try {
    response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  } catch {
    throw new AppError(502, 'GOOGLE_AUTH_UNAVAILABLE', 'Could not verify Google sign-in');
  }
  if (!response.ok) {
    throw new AppError(401, 'INVALID_GOOGLE_CREDENTIAL', 'Google credential is invalid or expired');
  }

  const profile = await response.json();
  if (profile.aud !== clientId) {
    throw new AppError(401, 'INVALID_GOOGLE_AUDIENCE', 'Google credential was issued for another app');
  }
  if (!(profile.email_verified === true || profile.email_verified === 'true')) {
    throw new AppError(403, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Google email is not verified');
  }
  if (!profile.sub || !profile.email) {
    throw new AppError(401, 'INVALID_GOOGLE_PROFILE', 'Google profile is incomplete');
  }
  return profile;
}

async function availableGoogleLogin(email) {
  const local = email.split('@')[0]
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_.-]+/gu, '')
    .slice(0, 42);
  const base = local.length >= 3 ? local : 'circleuser';

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const login = suffix ? `${base.slice(0, 42)}${suffix}` : base;
    const [rows] = await pool.execute('SELECT id FROM users WHERE login=? LIMIT 1', [login]);
    if (!rows[0]) return login;
  }
  return `circle${crypto.randomBytes(5).toString('hex')}`;
}

export async function authenticateWithGoogleCredential(body) {
  const profile = await fetchGoogleProfile(body?.credential);
  const email = normalizeEmail(profile.email);
  validateEmail(email);

  const [byGoogleRows] = await pool.execute(
    'SELECT * FROM users WHERE google_sub=? LIMIT 1',
    [profile.sub],
  );
  let user = byGoogleRows[0];

  if (!user) {
    const [byEmailRows] = await pool.execute(
      'SELECT * FROM users WHERE email=? LIMIT 1',
      [email],
    );
    user = byEmailRows[0];

    if (user) {
      if (user.google_sub && user.google_sub !== profile.sub) {
        throw new AppError(409, 'GOOGLE_ACCOUNT_CONFLICT', 'This email is linked to another Google account');
      }
      await pool.execute(
        `UPDATE users
         SET google_sub=?, email_verified=1,
             verification_token=NULL, verification_token_expires=NULL,
             verification_code_hash=NULL, verification_code_expires=NULL,
             avatar=COALESCE(avatar, ?)
         WHERE id=?`,
        [profile.sub, profile.picture || null, user.id],
      );
    } else {
      const login = await availableGoogleLogin(email);
      const fallbackPassword = crypto.randomBytes(48).toString('base64url');
      const passwordHash = await bcrypt.hash(fallbackPassword, 12);
      const fullName = validateFullName(profile.name || '');

      const [insert] = await pool.execute(
        `INSERT INTO users(
           login,password_hash,full_name,email,email_verified,avatar,role,google_sub
         ) VALUES(?,?,?,?,1,?,'user',?)`,
        [login, passwordHash, fullName, email, profile.picture || null, profile.sub],
      );
      user = await User.findById(insert.insertId);
    }
  }

  const safeUser = await User.findById(user.id);
  return { token: signAuthToken({ ...user, ...safeUser }), user: safeUser };
}
