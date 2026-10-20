import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api, isDemoMode } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

function VerificationForm({ email, delivery, initialCode, login, password, onLogin }) {
  const {t}=usePreferences();
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
    <div className="verificationVisual" aria-hidden="true">
      <span className="verifyHalo verifyHaloOne"></span><span className="verifyHalo verifyHaloTwo"></span>
      <span className="verificationLetter">✉<span>✦</span></span>
    </div>
    <h1>{t('Confirm your email')}</h1>
    <p>{t('Enter the code sent to')} <b>{email}</b></p>
    {lastDelivery && lastDelivery !== 'sent' && <p className="error card">Your account was created, but no email was sent. Configure SMTP and request a new code. Avoid registering again with the same address.</p>}
    <label className="verifyCodeLabel">{t('Verification code')}
      <input aria-label="Six-digit verification code" className="verifyCodeInput" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength="6"
        placeholder="••••••" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </label>
    <p className="verifyHint">{t('Check Inbox and Spam. Your code is valid for 20 minutes.')}</p>
    <div className="toolbar">
      <button className="primary authSubmit" disabled={busy || code.length !== 6}>{t('Confirm email')} <span aria-hidden="true">→</span></button>
      <button className="verifyResend" type="button" onClick={resend} disabled={busy}>{t('Resend code')}</button>
      <button className="verifyResend" type="button" onClick={() => go('/login')}>{t('Back to login')}</button>
    </div>
    {message && <p role="status">{message}</p>}
    <ErrorBox error={error} />
  </form>;
}


/* A small gallery of original, code-drawn hobby illustrations.
   Kept local so the sign-in screen never relies on remote image hosts. */
function CircleArtTile({ variant }) {
  const common = { viewBox: '0 0 96 96', xmlns: 'http://www.w3.org/2000/svg', focusable: 'false' };
  switch (variant) {
    case 0: return <svg {...common}><circle cx="48" cy="48" r="33" fill="#F6D8EB"/><path d="M27 65c15-18 27-26 41-33" fill="none" stroke="#315C4C" strokeWidth="4" strokeLinecap="round"/><path d="M42 50c-18-1-17-19-4-20 10 3 11 12 4 20Zm12-9c-3-15 12-21 20-11 1 10-8 16-20 11Z" fill="#6DAB89"/><circle cx="63" cy="27" r="10" fill="#F2849E"/><circle cx="63" cy="27" r="4" fill="#FBE4A6"/></svg>;
    case 1: return <svg {...common}><rect x="13" y="15" width="70" height="68" rx="20" fill="#1D2741"/><circle cx="58" cy="32" r="17" fill="#F9E2A6"/><circle cx="64" cy="26" r="16" fill="#1D2741"/><path d="m30 35 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm41 20 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#F8EBD4"/><path d="M19 73c16-15 39-11 61-1" fill="none" stroke="#7E95BC" strokeWidth="4" strokeLinecap="round"/></svg>;
    case 2: return <svg {...common}><rect x="9" y="9" width="78" height="78" rx="18" fill="#F9B6A9"/><circle cx="66" cy="32" r="19" fill="#FFE2A6"/><path d="M9 64 32 35l21 23 14-16 20 20v24H9Z" fill="#C57997"/><path d="M9 74 33 55l19 18 13-8 22 13v8H9Z" fill="#644E8C"/></svg>;
    case 3: return <svg {...common}><rect x="11" y="10" width="74" height="76" rx="23" fill="#F8E8D2"/><path d="M32 62V42c0-10 7-17 16-17s16 7 16 17v20c0 10-6 15-16 15s-16-5-16-15Z" fill="#24252A"/><path d="M32 41 26 25q10-3 19 6m19 10 6-16q-10-3-19 6" fill="#24252A"/><ellipse cx="40" cy="49" rx="3" ry="5" fill="#FFF"/><ellipse cx="56" cy="49" rx="3" ry="5" fill="#FFF"/><path d="M46 58q2 3 4 0" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round"/></svg>;
    case 4: return <svg {...common}><rect x="10" y="10" width="76" height="76" rx="22" fill="#D6C3F1"/><path d="M20 64c18-43 34-50 55-33M20 74c15-37 36-47 56-30M30 81c11-21 26-28 44-24" stroke="#8061B9" strokeWidth="11" fill="none" strokeLinecap="round"/><circle cx="63" cy="31" r="8" fill="#F0B5D4"/></svg>;
    case 5: return <svg {...common}><rect x="9" y="9" width="78" height="78" rx="18" fill="#BBD8E5"/><path d="M19 79V57L35 23l17 28 13-16 13 27v17Z" fill="#4A83A0"/><path d="M35 23 25 44l9-6 9 11 9 2ZM65 35l-9 20 9-7 8 7Z" fill="#FFF8EF"/><path d="M9 70q20-16 39 0t39 0v17H9Z" fill="#6B9D82"/></svg>;
    case 6: return <svg {...common}><rect x="9" y="9" width="78" height="78" rx="22" fill="#EDD0D7"/><path d="M27 40c0-15 11-25 24-25 14 0 24 10 24 25 0 7-4 15-8 22l-2 16H37l-2-17c-5-7-8-14-8-21Z" fill="#9C544A"/><ellipse cx="50" cy="34" rx="20" ry="16" fill="#C77E69"/><path d="M36 32c7 4 14 2 23-4 5 7 9 8 15 7" stroke="#66372F" strokeWidth="7" fill="none" strokeLinecap="round"/><circle cx="43" cy="43" r="2.8"/><circle cx="61" cy="43" r="2.8"/><path d="M46 54q7 5 14-1" stroke="#66372F" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>;
    case 7: return <svg {...common}><rect x="10" y="10" width="76" height="76" rx="19" fill="#CFECDF"/><circle cx="48" cy="44" r="22" fill="#F3AEB9"/><g fill="#FFF7EA"><ellipse cx="48" cy="25" rx="9" ry="16"/><ellipse cx="48" cy="63" rx="9" ry="16"/><ellipse cx="29" cy="44" rx="16" ry="9"/><ellipse cx="67" cy="44" rx="16" ry="9"/></g><circle cx="48" cy="44" r="10" fill="#EAA74E"/><path d="M48 78v9" stroke="#527967" strokeWidth="4"/></svg>;
    default: return <svg {...common}><rect x="9" y="9" width="78" height="78" rx="21" fill="#F4D6B5"/><path d="M17 60c15-20 30-15 37-36 8 15 24 14 25 35" fill="none" stroke="#B56E6B" strokeWidth="13" strokeLinecap="round"/><path d="M21 76c19-21 36-22 53-6" fill="none" stroke="#896B9B" strokeWidth="10" strokeLinecap="round"/><circle cx="54" cy="24" r="8" fill="#E8A24E"/></svg>;
  }
}
function CircleAuthGallery() {
  return <div className="circleAuthGallery" aria-hidden="true">
    {Array.from({ length: 9 }, (_, index) =>
      <span className={`circleAuthTile circleAuthTile--${index + 1}`} key={index}>
        <CircleArtTile variant={index}/>
      </span>)}
  </div>;
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
    go(result.user?.banned_at ? '/ban' : firstRegistration ? '/interests' : '/');
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


  return <main key={mode} className={`circleAuthScreen ${register ? 'circleAuthScreen--register' : 'circleAuthScreen--login'}`}>
    <CircleAuthGallery />
    <section className="circleAuthContent">
      {verification ? <div className="circleAuthVerify">
        <VerificationForm {...verification} onLogin={result => logIn(result, true)} />
      </div> : <>
        <div className="circleAuthHeading">
          <h1>{t(register ? 'Create account' : 'Welcome back')}</h1>
          <p>{register
            ? (t('Join the conversation. Create your Circle profile.'))
            : (t('Sign in to continue the conversation.'))}</p>
        </div>
        {isDemoMode() && <p className="circleAuthDemo" role="note">
          {t('Preview mode: accounts and email are simulated.')}
        </p>}
        <form className="circleAuthForm" onSubmit={submit}>
          {register ? <>
            <label>{t('Username')}<input autoComplete="username" required minLength="3" maxLength="50"
              value={form.login} onChange={field('login')} placeholder="yourname"/></label>
            <label>{t('Full name')}<input autoComplete="name" maxLength="100"
              value={form.fullName} onChange={field('fullName')} placeholder={t('Your name')}/></label>
            <label>{t('Email')}<input type="email" autoComplete="email" required
              value={form.email} onChange={field('email')} placeholder="name@example.com"/></label>
          </> : <label>{t('Username or email')}
            <input autoComplete="username" required value={form.identifier} onChange={field('identifier')}
              placeholder={t('Username or email')}/>
          </label>}
          <label>{t('Password')}
            <input type="password" autoComplete={register ? 'new-password' : 'current-password'}
              required minLength={register ? 8 : undefined} maxLength="128"
              value={form.password} onChange={field('password')}
              placeholder={t('Password')}/>
          </label>
          {register && <label>{t('Confirm password')}
            <input type="password" autoComplete="new-password" required minLength="8" maxLength="128"
              value={form.passwordConfirmation} onChange={field('passwordConfirmation')}
              placeholder={t('Confirm password')}/>
          </label>}
          {!register && <button className="circleAuthForgot" type="button" onClick={() => go('/reset')}>
            {t('Forgot password?')}
          </button>}
          <button type="submit" className="circleAuthSubmit" disabled={busy}>
            {t(busy ? 'Please wait…' : register ? 'Create account' : 'Log in')}
            <span aria-hidden="true">↗</span>
          </button>
          <ErrorBox error={error}/>
        </form>
        <div className="circleAuthSwitch">
          <span>{t(register ? 'Already part of Circle?' : 'New to Circle?')}</span>
          <button type="button" onClick={() => go(register ? '/login' : '/register')}>
            {t(register ? 'Log in' : 'Create an account')}
          </button>
        </div>
        {!register && <div className="circleAuthRecovery">
          <button type="button" className="circleAuthRecoveryToggle"
            aria-expanded={recovery} onClick={() => setRecovery(value => !value)}>
            {t('Need a new email verification code?')}
          </button>
          {recovery && <form className="circleAuthRecoveryForm" onSubmit={resendAfterLeaving}>
            <label>{t('Registration email')}
              <input type="email" required autoComplete="email" value={recoveryEmail}
                onChange={event => setRecoveryEmail(event.target.value)} placeholder="name@example.com"/>
            </label>
            <button className="circleAuthResend" type="submit" disabled={busy}>
              {t('Send new code')}
            </button>
            {recoveryMessage && <p role="status">{recoveryMessage}</p>}
            <ErrorBox error={error}/>
          </form>}
        </div>}
      </>}
    </section>
  </main>;
}

export function VerifyPage({ token }) {
  const {t}=usePreferences();
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
      <h1>{t('Email confirmation')}</h1>
      {busy ? <p>{t('Verifying…')}</p> : message && <p>{t(message)}</p>}
      <ErrorBox error={error} />
      <button className="primary" onClick={() => go('/login')}>{t('Continue to login')}</button>
    </section>
  </main>;
}

export function ResetPage({ token }) {
  const {t}=usePreferences();
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
      <h1>{t(token ? 'Choose new password' : 'Reset password')}</h1>
      {token ? <>
        <label>{t('New password')}<input type="password" required minLength="8" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>{t('Confirm password')}<input type="password" required minLength="8" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      </> : <label>{t('Email')}<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      <button className="primary" disabled={busy}>{t(token ? 'Change password' : 'Send reset link')}</button>
      {message && <p role="status">{message}</p>}
      {devToken && <button type="button" onClick={() => go('/reset/' + devToken)}>Use local test token</button>}
      <ErrorBox error={error} />
      <button type="button" onClick={() => go('/login')}>{t('Back to login')}</button>
    </form>
  </main>;
}
