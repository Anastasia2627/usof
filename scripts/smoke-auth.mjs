const base = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';

async function request(path, { method = 'GET', token, body, expected = 200 } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status !== expected) {
    throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const stamp = String(Date.now());
const login = `smoke_${stamp.slice(-8)}`;
const email = `${login}@example.com`;
const password = `S-${stamp}-Aa9!`;
const newPassword = `N-${stamp}-Bb8!`;

const registration = await request('/auth/register', {
  method: 'POST',
  expected: 201,
  body: { login, email, password, passwordConfirmation: password, fullName: 'Smoke User' },
});
if (!registration.verificationToken) throw new Error('Development verification token missing');

await request('/auth/login', {
  method: 'POST',
  expected: 403,
  body: { login, email, password },
});
await request(`/auth/verify-email/${registration.verificationToken}`, { method: 'POST' });

let session = await request('/auth/login', {
  method: 'POST',
  body: { login, email, password },
});
const oldToken = session.token;
await request('/auth/logout', { method: 'POST', token: oldToken, expected: 204 });
await request(`/users/${registration.user.id}`, { token: oldToken, expected: 401 });

session = await request('/auth/login', {
  method: 'POST',
  body: { login, email, password },
});
const reset = await request('/auth/password-reset', {
  method: 'POST',
  body: { email },
});
if (!reset.resetToken) throw new Error('Development reset token missing');
await request(`/auth/password-reset/${reset.resetToken}`, {
  method: 'POST',
  body: { newPassword },
});
await request(`/users/${registration.user.id}`, { token: session.token, expected: 401 });
await request('/auth/login', {
  method: 'POST',
  expected: 401,
  body: { login, email, password },
});
await request('/auth/login', {
  method: 'POST',
  body: { login, email, password: newPassword },
});

console.log('Authentication smoke test passed.');
