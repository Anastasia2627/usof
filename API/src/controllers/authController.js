import {
  authenticate,
  consumePasswordReset,
  invalidateSession,
  issuePasswordReset,
  registerAccount,
  verifyEmailToken,
} from '../services/authService.js';

export async function register(req, res) {
  res.status(201).json(await registerAccount(req.body));
}

export async function verifyEmail(req, res) {
  await verifyEmailToken(req.params.token);
  res.json({ message: 'Email verified' });
}

export async function login(req, res) {
  res.json(await authenticate(req.body));
}

export async function logout(req, res) {
  await invalidateSession(req.user.sub);
  res.status(204).end();
}

export async function requestPasswordReset(req, res) {
  res.json(await issuePasswordReset(req.body));
}

export async function confirmPasswordReset(req, res) {
  await consumePasswordReset(req.params.confirm_token, req.body.newPassword);
  res.json({ message: 'Password changed' });
}
