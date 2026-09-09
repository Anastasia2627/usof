import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';

export function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ identifier: '', login: '', email: '', fullName: '', password: '', passwordConfirmation: '' });
  const [error, setError] = useState(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        const result = await api('/auth/register', { method: 'POST', body: {
          login: form.login,
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          passwordConfirmation: form.passwordConfirmation,
        } });
        if (result.verificationToken) setVerificationToken(result.verificationToken);
        else go('/login');
      } else {
        const identifier = form.identifier.trim();
        const body = identifier.includes('@')
          ? { email: identifier, password: form.password }
          : { login: identifier, password: form.password };
        const result = await api('/auth/login', { method: 'POST', body });
        dispatch({ type: 'AUTH_SET', payload: result });
        go('/');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (verificationToken) return <main className="narrow">
    <div className="card successPanel">
      <p className="eyebrow">Account created</p>
      <h1>Verify your email</h1>
      <p>In development mode Usof exposes the verification token so the flow can be tested without SMTP. If SMTP is configured, a link is also sent to the provided email.</p>
      <code className="tokenBox">{verificationToken}</code>
      <button className="primary" onClick={() => go(`/verify/${verificationToken}`)}>Verify this account</button>
    </div>
  </main>;

  return <main className="narrow authPage">
    <p className="eyebrow">{isRegister ? 'Join the knowledge loop' : 'Good to see you again'}</p>
    <h1>{isRegister ? 'Create account' : 'Log in'}</h1>
    <form className="card form" onSubmit={submit}>
      {isRegister ? <>
        <label>Login<input autoComplete="username" minLength="3" maxLength="50" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} /></label>
        <label>Full name<input maxLength="100" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
        <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      </> : <label>Login or email<input autoComplete="username" required value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></label>}
      <label>Password<input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" maxLength="128" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {isRegister && <label>Confirm password<input type="password" autoComplete="new-password" minLength="8" maxLength="128" required value={form.passwordConfirmation} onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })} /></label>}
      <button className="primary" disabled={busy}>{busy ? 'Working…' : isRegister ? 'Create account' : 'Log in'}</button>
      <ErrorBox error={error} />
    </form>
    <div className="underForm">
      <button className="linkButton" onClick={() => go(isRegister ? '/login' : '/register')}>{isRegister ? 'Already have an account? Log in' : 'Need an account? Sign up'}</button>
      {!isRegister && <button className="linkButton" onClick={() => go('/reset')}>Forgot password?</button>}
    </div>
  </main>;
}

export function VerifyPage({ token }) {
  const [state, setState] = useState({ busy: Boolean(token), message: '', error: null });
  const [manual, setManual] = useState(token || '');

  async function verify(value) {
    const clean = String(value || '').trim();
    if (!clean) return;
    setState({ busy: true, message: '', error: null });
    try {
      const result = await api(`/auth/verify-email/${encodeURIComponent(clean)}`, { method: 'POST' });
      setState({ busy: false, message: result.message, error: null });
    } catch (error) {
      setState({ busy: false, message: '', error });
    }
  }

  useEffect(() => { if (token) verify(token); }, [token]);

  return <main className="narrow">
    <h1>Email verification</h1>
    <div className="card form">
      {state.busy ? <p>Verifying…</p> : state.message ? <>
        <div className="alert success">{state.message}</div>
        <button className="primary" onClick={() => go('/login')}>Continue to login</button>
      </> : <>
        <label>Verification token<input value={manual} onChange={(e) => setManual(e.target.value)} /></label>
        <button className="primary" onClick={() => verify(manual)}>Verify email</button>
      </>}
      <ErrorBox error={state.error} />
    </div>
  </main>;
}

export function ResetPage({ token }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devToken, setDevToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function request(event) {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const result = await api('/auth/password-reset', { method: 'POST', body: { email } });
      setMessage(result.message);
      setDevToken(result.resetToken || '');
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  async function change(event) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirm) return setError(new Error('Password confirmation does not match'));
    setBusy(true);
    try {
      const result = await api(`/auth/password-reset/${encodeURIComponent(token)}`, { method: 'POST', body: { newPassword } });
      setMessage(result.message);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  return <main className="narrow">
    <h1>{token ? 'Choose a new password' : 'Reset password'}</h1>
    <form className="card form" onSubmit={token ? change : request}>
      {token ? <>
        <label>New password<input type="password" minLength="8" maxLength="128" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label>Confirm password<input type="password" minLength="8" maxLength="128" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
      </> : <>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create reset link'}</button>
      </>}
      {message && <div className="alert success">{message}</div>}
      {devToken && <div className="devToken"><small>Development token</small><code>{devToken}</code><button type="button" className="secondary" onClick={() => go(`/reset/${devToken}`)}>Use token</button></div>}
      <ErrorBox error={error} />
    </form>
  </main>;
}
