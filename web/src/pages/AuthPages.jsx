import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api, isDemoMode } from '../api.js';
import { ErrorBox, Icon, go } from '../ui.jsx';
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


/* Gallery artwork exported from the user's Figma designs.
   These assets are served locally from web/public/images. */
const circleAuthImages = [
  'Frame 2072750583.png',
  'Frame 2072750584.png',
  'Frame 2072750585.png',
  'Frame 2072750586.png',
  'Frame 2072750587.png',
  'Frame 2072750588.png',
  'Frame 2072750589.png',
  'Frame 2072750590.png',
  'Frame 2072750591.png',
  'Frame 2072750592.png',
  'Frame 2072750593.png',
  'Frame 2072750594.png',
];

function CircleAuthGallery() {
  return <div className="circleAuthGallery" aria-hidden="true">
    {circleAuthImages.map((filename, index) => (
      <span className={`circleAuthTile circleAuthTile--${index + 1}`} key={filename}>
        <img src={`/images/${encodeURIComponent(filename)}`} alt=""
          draggable="false" decoding="async" />
      </span>
    ))}
  </div>;
}

function AuthInput({ label, icon, type = 'text', visible = false, toggleVisibility, showLabel, hideLabel, ...props }) {
  const id = React.useId();
  const canReveal = type === 'password';
  return <div className="circleAuthInputLabel">
    <label htmlFor={id}>{label}</label>
    <span className="circleAuthInputShell">
      <Icon name={icon} size={18}/>
      <input {...props} id={id} type={canReveal && visible ? 'text' : type}/>
      {canReveal && <button type="button" className="circleAuthVisibility"
        onClick={toggleVisibility} aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel} aria-pressed={visible}>
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18}/>
      </button>}
    </span>
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
        </div>
        {isDemoMode() && <p className="circleAuthDemo" role="note">
          {t('Preview mode: accounts and email are simulated.')}
        </p>}
        <form className="circleAuthForm" onSubmit={submit}>
          {register ? <>
            <AuthInput label={t('Username')} icon="user" autoComplete="username"
              required minLength="3" maxLength="50" value={form.login}
              onChange={field('login')} placeholder="yourname"/>
            <AuthInput label={t('Full name')} icon="user" autoComplete="name"
              maxLength="100" value={form.fullName}
              onChange={field('fullName')} placeholder={t('Your name')}/>
            <AuthInput label={t('Email')} icon="mail" type="email" autoComplete="email"
              required value={form.email} onChange={field('email')} placeholder="name@example.com"/>
          </> : <AuthInput label={t('Username or email')} icon="user" autoComplete="username"
              required value={form.identifier} onChange={field('identifier')}
              placeholder={t('Username or email')}/>}
          <AuthInput label={t('Password')} icon="lock" type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            required minLength={register ? 8 : undefined} maxLength="128"
            value={form.password} onChange={field('password')} placeholder={t('Password')}
            visible={showPassword} toggleVisibility={() => setShowPassword(v => !v)}
            showLabel={t('Show password')} hideLabel={t('Hide password')}/>
          {register && <AuthInput label={t('Confirm password')} icon="lock" type="password"
            autoComplete="new-password" required minLength="8" maxLength="128"
            value={form.passwordConfirmation} onChange={field('passwordConfirmation')}
            placeholder={t('Confirm password')}
            visible={showConfirmation} toggleVisibility={() => setShowConfirmation(v => !v)}
            showLabel={t('Show password')} hideLabel={t('Hide password')}/>}
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
