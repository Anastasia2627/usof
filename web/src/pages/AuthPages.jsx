import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api, isDemoMode } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

function VerificationForm({ email, delivery, initialCode, login, password, onLogin }) {
  const [code, setCode] = useState(initialCode || '');
  const [lastDelivery, setLastDelivery] = useState(delivery);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/auth/verify-email-code', { method: 'POST', body: { email, code } });
      setMessage('Email confirmed.');
      if (login && password) {
        const result = await api('/auth/login', { method: 'POST', body: { login, password } });
        onLogin(result);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const result = await api('/auth/resend-verification', { method: 'POST', body: { email } });
      if (result.verificationCode) setCode(result.verificationCode);
      if (result.emailDelivery) {
        setLastDelivery(result.emailDelivery);
        if (result.emailDelivery !== 'sent') {
          setError(new Error('The SMTP server did not accept the email. Check mail settings and retry in one minute.'));
        } else {
          setMessage('A new verification email was accepted by your mail provider. Check Inbox and Spam.');
        }
      } else {
        setMessage(result.message || 'If confirmation is needed, an email will be sent.');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return <form className="authForm verificationForm" onSubmit={verify}>
    <h1>Confirm your email</h1>
    <p>Enter the six-digit code sent to <b>{email}</b>.</p>
    {lastDelivery && lastDelivery !== 'sent' && <p className="error card">Your account was created, but no email was sent. Configure SMTP and request a new code. Avoid registering again with the same address.</p>}
    <label>Verification code
      <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength="6"
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </label>
    <div className="toolbar">
      <button className="primary authSubmit" disabled={busy}>Verify email</button>
      <button type="button" onClick={resend} disabled={busy}>Resend code</button>
      <button type="button" onClick={() => go('/login')}>Log in</button>
    </div>
    {message && <p role="status">{message}</p>}
    <ErrorBox error={error} />
  </form>;
}

export function AuthPage({ mode }) {
  const {t}=usePreferences();
  const dispatch = useDispatch();
  const register = mode === 'register';
  const [form, setForm] = useState({
    identifier: '', login: '', email: '', fullName: '', password: '', passwordConfirmation: '',
  });
  const [verification, setVerification] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function logIn(result, firstRegistration = false) {
    dispatch({ type: 'AUTH_SET', payload: result });
    go(firstRegistration ? '/interests' : '/');
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (register) {
        if (form.password !== form.passwordConfirmation) throw new Error('Passwords do not match.');
        const result = await api('/auth/register', { method: 'POST', body: {
          login: form.login, email: form.email, fullName: form.fullName,
          password: form.password, passwordConfirmation: form.passwordConfirmation,
        } });
        if (isDemoMode()) logIn({ token: result.token, user: result.user },true);
        else setVerification({ email: form.email, delivery: result.emailDelivery, initialCode: result.verificationCode || '',
          login: form.login, password: form.password });
      } else {
        const identifier = form.identifier.trim();
        const result = await api('/auth/login', { method: 'POST',
          body: identifier.includes('@') ? { email: identifier, password: form.password } : { login: identifier, password: form.password } });
        logIn(result);
      }
    } catch (err) {
      setError(err);
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setRecovery(true);
        if (form.identifier.includes('@')) setRecoveryEmail(form.identifier);
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendAfterLeaving(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api('/auth/resend-verification', { method: 'POST', body: { email: recoveryEmail } });
      if (result.emailDelivery) {
        setVerification({ email: recoveryEmail, delivery: result.emailDelivery, initialCode: result.verificationCode || '',
          login: null, password: null });
      } else setRecoveryMessage(result.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const field = name => event => setForm(previous => ({ ...previous, [name]: event.target.value }));

  return <main className="authShell authRefined">
    <aside className="authEditorial" aria-label="About Circle">
      <div className="authEditorialBrand"><span aria-hidden="true">◎</span> circle</div>
      <div className="authEditorialStory">
        <span className="authEditorialEyebrow">A SPACE TO CONNECT</span>
        <h2>{t('Good conversations start here.')}</h2>
        <p>{t('Share what you love. Find people who get it. Discover a little something new every day.')}</p>
        <div className="authEditorialTopics"><span>{t('Art & ideas')}</span><span>{t('Little discoveries')}</span><span>{t('Real people')}</span></div>
      </div>
      <p className="authEditorialFootnote">{t('One community. Countless perspectives.')}</p>
    </aside>
    <section className="authPanel">
      {verification ? <VerificationForm {...verification} onLogin={result => logIn(result,true)} /> : <>
        <span className="authPanelEyebrow">{t(register ? 'JOIN THE COMMUNITY' : 'NICE TO SEE YOU AGAIN')}</span>
        <h1>{t(register ? 'Create account' : 'Welcome back')}</h1>
        <p className="authPanelCopy">{t(register ? 'A few details and you are ready to join the conversation.' : 'Log in to pick up where you left off.')}</p>
        {isDemoMode() && <p className="card alert" role="note">Preview mode: accounts and email are simulated. Use npm run web with the real API and SMTP to receive actual messages.</p>}
        <form className="authForm" onSubmit={submit}>
          {register ? <>
            <label>{t('Username')}<input autoComplete="username" required minLength="3" maxLength="50" value={form.login} onChange={field('login')} /></label>
            <label>{t('Full name')}<input maxLength="100" value={form.fullName} onChange={field('fullName')} /></label>
            <label>{t('Email')}<input type="email" autoComplete="email" required value={form.email} onChange={field('email')} /></label>
          </> : <label>{t('Username or email')}
            <input autoComplete="username" required value={form.identifier} onChange={field('identifier')} />
          </label>}
          <label>{t('Password')}
            <input type="password" autoComplete={register ? 'new-password' : 'current-password'}
              required minLength={register ? 8 : undefined} value={form.password} onChange={field('password')} />
          </label>
          {register && <label>{t('Confirm password')}
            <input type="password" autoComplete="new-password" required minLength="8"
              value={form.passwordConfirmation} onChange={field('passwordConfirmation')} />
          </label>}
          <button className="primary authSubmit" disabled={busy}>{t(busy ? 'Please wait…' : register ? 'Create account' : 'Log in')}</button>
          <ErrorBox error={error} />
        </form>
        <div className="toolbar authSwitchLinks">
          <p>{t(register ? 'Already part of Circle?' : 'New to Circle?')}</p>
          <button type="button" onClick={() => go(register ? '/login' : '/register')}>
            {t(register ? 'Log in' : 'Create an account')}
          </button>
          {!register && <button type="button" className="authForgotLink" onClick={() => go('/reset')}>{t('Forgot password?')}</button>}
        </div>
        {!register && <div className="authRecovery">
          <button className="linkButton" onClick={() => setRecovery(value => !value)}>{t('Need a new email verification code?')}</button>
          {recovery && <form className="form" onSubmit={resendAfterLeaving}>
            <label>Registration email<input type="email" required value={recoveryEmail}
              onChange={e => setRecoveryEmail(e.target.value)} /></label>
            <button className="secondary" disabled={busy}>Send new code</button>
            {recoveryMessage && <p role="status">{recoveryMessage}</p>}
          </form>}
        </div>}
      </>}
    </section>
  </main>;
}

export function VerifyPage({ token }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    api('/auth/verify-email/' + encodeURIComponent(token), { method: 'POST' })
      .then(result => setMessage(result.message || 'Email verified.'))
      .catch(setError)
      .finally(() => setBusy(false));
  }, [token]);

  return <main className="authStandalone">
    <section className="verificationLinkPanel">
      <h1>Email confirmation</h1>
      {busy ? <p>Verifying…</p> : message && <p>{message}</p>}
      <ErrorBox error={error} />
      <button className="primary" onClick={() => go('/login')}>Continue to login</button>
    </section>
  </main>;
}

export function ResetPage({ token }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [devToken, setDevToken] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (token) {
        if (password !== confirm) throw new Error('Passwords do not match.');
        const result = await api('/auth/password-reset/' + encodeURIComponent(token), {
          method: 'POST', body: { newPassword: password },
        });
        setMessage(result.message || 'Password changed. You can now log in.');
      } else {
        const result = await api('/auth/password-reset', { method: 'POST', body: { email } });
        setMessage(result.message || 'Check your email for the reset link.');
        setDevToken(result.resetToken || '');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return <main className="authStandalone">
    <form className="resetPanel authForm" onSubmit={submit}>
      <h1>{token ? 'Choose new password' : 'Reset password'}</h1>
      {token ? <>
        <label>New password<input type="password" required minLength="8" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Confirm password<input type="password" required minLength="8" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      </> : <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      <button className="primary" disabled={busy}>{token ? 'Change password' : 'Send reset link'}</button>
      {message && <p role="status">{message}</p>}
      {devToken && <button type="button" onClick={() => go('/reset/' + devToken)}>Use local test token</button>}
      <ErrorBox error={error} />
      <button type="button" onClick={() => go('/login')}>Back to login</button>
    </form>
  </main>;
}
