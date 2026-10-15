import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api, isDemoMode } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { ErrorBox, Icon, go } from '../ui.jsx';

function MascotStage({ mood = 'idle' }) {
  const stageRef = useRef(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);

  useEffect(() => {
    function follow(event) {
      targetRef.current = {
        x: Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2)),
        y: Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2)),
      };
    }

    function animate() {
      const current = currentRef.current;
      const target = targetRef.current;
      current.x += (target.x - current.x) * 0.075;
      current.y += (target.y - current.y) * 0.075;

      const stage = stageRef.current;
      if (stage) {
        stage.style.setProperty('--look-x', `${current.x * 10}px`);
        stage.style.setProperty('--look-y', `${current.y * 8}px`);
        stage.style.setProperty('--loop-x', `${current.x * 16}px`);
        stage.style.setProperty('--loop-y', `${current.y * 11}px`);
        stage.style.setProperty('--mallow-x', `${current.x * 11}px`);
        stage.style.setProperty('--mallow-y', `${current.y * 8}px`);
        stage.style.setProperty('--pip-x', `${current.x * 22}px`);
        stage.style.setProperty('--pip-y', `${current.y * 14}px`);
      }
      frameRef.current = window.requestAnimationFrame(animate);
    }

    window.addEventListener('pointermove', follow, { passive: true });
    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('pointermove', follow);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <section ref={stageRef} className={`mascotStage mood-${mood}`} aria-label="Circle mascots">
    <button type="button" className="authBrandWord" onClick={() => go('/')}>circle</button>

    <div className="mascotScene" aria-hidden="true">
      <div className="mascot mascot-loop">
        <div className="mascotEyes"><i /><i /></div>
        <span className="mascotShine" />
      </div>
      <div className="mascot mascot-mallow">
        <div className="mascotEyes"><i /><i /></div>
        <span className="mascotShine" />
      </div>
      <div className="mascot mascot-pip">
        <div className="mascotEyes"><i /><i /></div>
        <span className="mascotShine" />
      </div>
      <div className="mailOrb"><Icon name="mail" filled /></div>
      <div className="thoughtDots"><i /><i /><i /></div>
    </div>
  </section>;
}

function GoogleLoginButton({ onError }) {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const mountRef = useRef(null);
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    if (!clientId || !mountRef.current) return undefined;
    let cancelled = false;

    async function handleCredential(response) {
      try {
        const result = await api('/auth/google', {
          method: 'POST',
          body: { credential: response.credential },
        });
        dispatch({ type: 'AUTH_SET', payload: result });
        go('/');
      } catch (error) {
        onError(error);
      }
    }

    function renderButton() {
      if (cancelled || !mountRef.current || !window.google?.accounts?.id) return;
      mountRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google.accounts.id.renderButton(mountRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(480, Math.max(260, mountRef.current.clientWidth || 400)),
      });
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return () => { cancelled = true; };
    }

    let script = document.querySelector('script[data-circle-google]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.circleGoogle = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderButton, { once: true });

    return () => {
      cancelled = true;
      script?.removeEventListener('load', renderButton);
    };
  }, [clientId, dispatch, onError]);

  if (!clientId) {
    return <button type="button" className="googleButton" onClick={() => onError(new Error('Set VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google sign-in.'))}>
      <span className="googleGlyph">G</span>{t('continueGoogle')}
    </button>;
  }

  return <div className="googleIdentityButton" ref={mountRef} aria-label={t('continueGoogle')} />;
}

function PasswordField({ label, value, onChange, autoComplete, onFocus, onBlur, onReveal, minLength = 8 }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  function toggle() {
    const next = !visible;
    setVisible(next);
    onReveal?.(next);
  }

  return <label className="fieldLabel">
    <span>{label}</span>
    <span className="passwordField">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength="128"
        required
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <button type="button" className="fieldIconButton" onClick={toggle} aria-label={visible ? t('hidePassword') : t('showPassword')}>
        <Icon name={visible ? 'visibility_off' : 'visibility'} />
      </button>
    </span>
  </label>;
}

function VerificationPanel({ email, emailDelivery, devToken, devCode, onVerified }) {
  const { t } = useI18n();
  const [code, setCode] = useState(devCode || '');
  const [delivery, setDelivery] = useState(emailDelivery || 'not-configured');
  const [state, setState] = useState({ busy: false, message: '', error: null, resendMessage: '' });

  async function verifyCode(event) {
    event.preventDefault();
    const clean = code.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setState((prev) => ({ ...prev, error: new Error('Enter the six-digit code from your email.') }));
      return;
    }
    setState({ busy: true, message: '', error: null, resendMessage: '' });
    try {
      const result = await api('/auth/verify-email-code', { method: 'POST', body: { email, code: clean } });
      setState({ busy: false, message: result.message || 'Email verified', error: null, resendMessage: '' });
      // Real login after verification, never before. Email links opened in other
      // tabs can still use the normal login form.
      try { await onVerified?.(); } catch { /* user can log in using button */ }
    } catch (error) {
      setState({ busy: false, message: '', error, resendMessage: '' });
    }
  }

  async function resend() {
    setState({ busy: true, message: '', error: null, resendMessage: '' });
    try {
      const result = await api('/auth/resend-verification', { method: 'POST', body: { email } });
      setDelivery(result.emailDelivery || 'unknown');
      setState({ busy: false, message: '', error: null, resendMessage: result.message });
    } catch (error) {
      setState({ busy: false, message: '', error, resendMessage: '' });
    }
  }

  if (state.message) {
    return <div className="verificationSuccess">
      <Icon name="check_circle" filled />
      <h1>Email verified</h1>
      <p>You can now log in to Circle.</p>
      <button className="primary" onClick={() => go('/login')}>{t('continueLogin')}</button>
    </div>;
  }

  const delivered = delivery === 'sent';
  return <form className="authForm verificationForm" onSubmit={verifyCode}>
    <h1>{t('checkInbox')}</h1>
    <p className="authLead">
      {delivered ? 'We sent a verification code and link to ' : 'Your account was created, but the confirmation email was not sent to '}
      <strong>{email}</strong>.
    </p>
    {!delivered && <p className="verificationDeliveryNotice" role="alert">
      {delivery === 'not-configured' ? 'Email sending is not configured on the server. Set up SMTP and try Resend.' :
        'Email delivery failed. Check SMTP settings and try Resend.'}
    </p>}
    <label className="fieldLabel verificationCodeField">
      <span>{t('verifyCodeLabel')}</span>
      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
        maxLength="6" placeholder="000000" value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
    </label>
    <button className="primary authSubmit" disabled={state.busy}>
      {state.busy ? t('verifying') : t('verify')} <Icon name="arrow_forward" />
    </button>
    <button type="button" className="linkButton" disabled={state.busy} onClick={resend}>Resend verification email</button>
    {state.resendMessage && <p role="status" className="authFinePrint">{state.resendMessage}</p>}
    {devToken && <button type="button" className="devVerifyLink" onClick={() => go('/verify/' + devToken)}>Local developer shortcut</button>}
    <ErrorBox error={state.error} />
    <p className="authFinePrint">Verification code and link expire after 20 minutes.</p>
  </form>;
}

export function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ identifier: '', login: '', email: '', fullName: '', password: '', passwordConfirmation: '' });
  const [error, setError] = useState(null);
  const [verification, setVerification] = useState(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState('idle');
  const [revealed, setRevealed] = useState(false);

  const mood = useMemo(() => {
    if (verification) return 'mail';
    if (busy) return 'thinking';
    if (error) return 'error';
    if (revealed) return 'revealed';
    if (focus === 'password') return 'password';
    if (focus === 'email') return 'email';
    return 'idle';
  }, [verification, busy, error, revealed, focus]);

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
        if (isDemoMode()) {
          dispatch({ type: 'AUTH_SET', payload: { token: result.token, user: result.user } });
          go('/');
        } else {
          setVerification({
            email: form.email,
            emailDelivery: result.emailDelivery,
            devToken: result.verificationToken || '',
            devCode: result.verificationCode || '',
          });
        }
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
      if (!isRegister && err.code === 'EMAIL_NOT_VERIFIED' && form.identifier.includes('@')) {
        setResendEmail(form.identifier.trim());
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendFromLogin() {
    setError(null);
    setResendMessage('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail.trim())) {
      setError(new Error('Enter your email address to request a verification code.'));
      return;
    }
    setBusy(true);
    try {
      const result = await api('/auth/resend-verification', {
        method: 'POST', body: { email: resendEmail.trim() },
      });
      if (result.emailDelivery) {
        setVerification({
          email: resendEmail.trim(),
          emailDelivery: result.emailDelivery,
          devToken: result.verificationToken || '',
          devCode: result.verificationCode || '',
        });
      } else {
        setResendMessage(result.message || 'If verification is needed, a code will be sent.');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const setField = (name) => (event) => setForm({ ...form, [name]: event.target.value });

  return <main className="authShell">
    <MascotStage mood={mood} />

    <section className="authPanel">
      {verification ? <VerificationPanel {...verification} onVerified={async () => {
        const result = await api('/auth/login', {
          method: 'POST',
          body: isRegister
            ? { login: form.login, password: form.password }
            : (form.identifier.includes('@')
              ? { email: form.identifier, password: form.password }
              : { login: form.identifier, password: form.password }),
        });
        dispatch({ type: 'AUTH_SET', payload: result });
        go('/');
      }} /> : <form className="authForm" onSubmit={submit}>
        <div className="authHeading">
          <h1>{isRegister ? t('createAccount') : t('welcomeBack')}</h1>
        </div>

        {import.meta.env.VITE_GOOGLE_CLIENT_ID && <>
          <GoogleLoginButton onError={setError} />
          <div className="authDivider"><span>or continue with email</span></div>
        </>}

        {isRegister ? <>
          <div className="fieldRow">
            <label className="fieldLabel">
              <span>{t('username')}</span>
              <input autoComplete="username" minLength="3" maxLength="50" required value={form.login} onChange={setField('login')} placeholder="yourname" />
            </label>
            <label className="fieldLabel">
              <span>{t('fullName')}</span>
              <input maxLength="100" value={form.fullName} onChange={setField('fullName')} placeholder="Your name" />
            </label>
          </div>
          <label className="fieldLabel">
            <span>{t('email')}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus('idle')}
              onChange={setField('email')}
              placeholder="you@example.com"
            />
          </label>
        </> : <label className="fieldLabel">
          <span>Username or email</span>
          <input
            autoComplete="username"
            required
            value={form.identifier}
            onFocus={() => setFocus(form.identifier.includes('@') ? 'email' : 'idle')}
            onBlur={() => setFocus('idle')}
            onChange={setField('identifier')}
            placeholder="@username or email"
          />
        </label>}

        <PasswordField
          label={t('password')}
          value={form.password}
          onChange={setField('password')}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          onFocus={() => setFocus('password')}
          onBlur={() => setFocus('idle')}
          onReveal={setRevealed}
        />

        {isRegister && <PasswordField
          label={t('confirmPassword')}
          value={form.passwordConfirmation}
          onChange={setField('passwordConfirmation')}
          autoComplete="new-password"
          onFocus={() => setFocus('password')}
          onBlur={() => setFocus('idle')}
          onReveal={setRevealed}
        />}

        <button className="primary authSubmit" disabled={busy}>
          {busy ? t('working') : isRegister ? t('create') : t('login')} <Icon name="arrow_forward" />
        </button>

        <ErrorBox error={error} />
        {!isRegister && <div className="authRecovery">
          <button type="button" className="linkButton" onClick={() => {
            setResendMessage('');
            setResendEmail(form.identifier.includes('@') ? form.identifier : '');
            setError(null);
            setResendMessage('Enter the email used when you registered.');
          }}>Need a new verification email?</button>
          {resendMessage && <p role="status">{resendMessage}</p>}
          {resendMessage && <label className="fieldLabel">
            <span>Registration email</span>
            <input type="email" autoComplete="email" value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)} placeholder="you@example.com" />
          </label>}
          {resendMessage && <button type="button" className="secondary" disabled={busy} onClick={resendFromLogin}>Send new code</button>}
        </div>}

        <div className="authSwitch">
          <span>{isRegister ? 'Already have a seat?' : 'New around here?'}</span>
          <button type="button" className="linkButton" onClick={() => go(isRegister ? '/login' : '/register')}>
            {isRegister ? t('login') : t('signup')}
          </button>
          {!isRegister && <button type="button" className="linkButton pushRight" onClick={() => go('/reset')}>Forgot password?</button>}
        </div>
      </form>}
    </section>
  </main>;
}

export function VerifyPage({ token }) {
  const { t } = useI18n();
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

  return <main className="authStandalone">
    <section className="card verificationLinkPanel">
      <div className={`verificationSeal ${state.message ? 'done' : ''}`}><Icon name={state.message ? 'check' : 'mark_email_unread'} filled /></div>
      <p className="eyebrow">Circle verification</p>
      <h1>{state.message ? 'Email verified' : 'Opening your seat…'}</h1>
      {state.busy ? <p>{t('verifying')}</p> : state.message ? <>
        <p>Your one-time link worked · you can log in now</p>
        <button className="primary" onClick={() => go('/login')}>{t('continueLogin')} <Icon name="arrow_forward" /></button>
      </> : <>
        <label className="fieldLabel">Verification token<input value={manual} onChange={(e) => setManual(e.target.value)} /></label>
        <button className="primary" onClick={() => verify(manual)}>{t('verify')}</button>
      </>}
      <ErrorBox error={state.error} />
    </section>
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
    setError(null);
    setBusy(true);
    try {
      const result = await api('/auth/password-reset', { method: 'POST', body: { email } });
      setMessage(result.message);
      setDevToken(result.resetToken || '');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function change(event) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(new Error('Password confirmation does not match'));
      return;
    }
    setBusy(true);
    try {
      const result = await api(`/auth/password-reset/${encodeURIComponent(token)}`, { method: 'POST', body: { newPassword } });
      setMessage(result.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return <main className="authStandalone">
    <form className="card resetPanel" onSubmit={token ? change : request}>
      <p className="eyebrow">Account access</p>
      <h1>{token ? 'Choose a new password' : 'Reset password'}</h1>
      {token ? <>
        <PasswordField label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        <PasswordField label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        <button className="primary" disabled={busy}>{busy ? 'Changing…' : 'Change password'} <Icon name="arrow_forward" /></button>
      </> : <>
        <label className="fieldLabel">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Send reset link'} <Icon name="arrow_forward" /></button>
      </>}
      {message && <div className="alert success">{message}</div>}
      {devToken && <button type="button" className="devVerifyLink" onClick={() => go(`/reset/${devToken}`)}>Use development reset link</button>}
      <ErrorBox error={error} />
    </form>
  </main>;
}
