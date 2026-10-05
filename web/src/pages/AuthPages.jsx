import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { ErrorBox, Icon, go } from '../ui.jsx';

function MascotStage({ mood = 'idle', headline, copy }) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function follow(event) {
      const x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2));
      setPointer({ x, y });
    }
    window.addEventListener('pointermove', follow, { passive: true });
    return () => window.removeEventListener('pointermove', follow);
  }, []);

  const vars = {
    '--look-x': `${pointer.x * 5}px`,
    '--look-y': `${pointer.y * 4}px`,
  };

  return <section className={`mascotStage mood-${mood}`} style={vars} aria-label="Circle mascots">
    <div className="authBrand">
      <button type="button" className="authBrandWord" onClick={() => go('/')}>circle</button>
      <span>your corner of the internet</span>
    </div>

    <div className="mascotCopy">
      <p className="eyebrow">A place for conversations</p>
      <h2>{headline}</h2>
      <p>{copy}</p>
    </div>

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

    <div className="mascotCaption">
      <span className="liveDot" /> They notice things.
    </div>
  </section>;
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

function VerificationPanel({ email, devToken, devCode }) {
  const { t } = useI18n();
  const [code, setCode] = useState(devCode || '');
  const [state, setState] = useState({ busy: false, message: '', error: null });

  async function verifyCode(event) {
    event.preventDefault();
    const clean = code.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setState({ busy: false, message: '', error: new Error('Enter the 6-digit code from your email') });
      return;
    }
    setState({ busy: true, message: '', error: null });
    try {
      const result = await api('/auth/verify-email-code', { method: 'POST', body: { email, code: clean } });
      setState({ busy: false, message: result.message || 'Email verified', error: null });
    } catch (error) {
      setState({ busy: false, message: '', error });
    }
  }

  if (state.message) {
    return <div className="verificationSuccess">
      <Icon name="check_circle" filled />
      <p className="eyebrow">{t('verified')}</p>
      <h1>Welcome to Circle.</h1>
      <p>Your email is verified. Your seat is officially yours.</p>
      <button className="primary" onClick={() => go('/login')}>{t('continueLogin')} <Icon name="arrow_forward" /></button>
    </div>;
  }

  return <form className="authForm verificationForm" onSubmit={verifyCode}>
    <p className="eyebrow">Almost there</p>
    <h1>{t('checkInbox')}</h1>
    <p className="authLead">We sent a 6-digit code and a one-time verification link to <strong>{email}</strong>.</p>
    <label className="fieldLabel verificationCodeField">
      <span>{t('verifyCodeLabel')}</span>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength="6"
        placeholder="000000"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </label>
    <button className="primary authSubmit" disabled={state.busy}>
      {state.busy ? t('verifying') : t('verify')} <Icon name="arrow_forward" />
    </button>
    {devToken && <button type="button" className="devVerifyLink" onClick={() => go(`/verify/${devToken}`)}>
      Development shortcut: open one-time link
    </button>}
    <ErrorBox error={state.error} />
    <p className="authFinePrint">The code and link expire and can be used only once.</p>
  </form>;
}

export function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ identifier: '', login: '', email: '', fullName: '', password: '', passwordConfirmation: '' });
  const [error, setError] = useState(null);
  const [verification, setVerification] = useState(null);
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
        setVerification({
          email: form.email,
          devToken: result.verificationToken || '',
          devCode: result.verificationCode || '',
        });
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

  const setField = (name) => (event) => setForm({ ...form, [name]: event.target.value });

  return <main className="authShell">
    <MascotStage
      mood={mood}
      headline={verification ? 'Incoming.' : isRegister ? 'Pull up a seat.' : 'They kept your spot.'}
      copy={verification
        ? 'The crew is waiting with you.'
        : isRegister
          ? 'Find your people, tell your story, join the thread.'
          : 'A lot happened while you were gone.'}
    />

    <section className="authPanel">
      {verification ? <VerificationPanel {...verification} /> : <form className="authForm" onSubmit={submit}>
        <div className="authHeading">
          <p className="eyebrow">{isRegister ? t('joinCopy') : t('loginCopy')}</p>
          <h1>{isRegister ? t('createAccount') : t('welcomeBack')}</h1>
          <p>{isRegister ? 'Start with a name. The rest can grow with you.' : 'Come back to the conversations you care about.'}</p>
        </div>

        <button type="button" className="googleButton" onClick={() => setError(new Error('Google sign-in is being connected to the Circle OAuth endpoint next.'))}>
          <span className="googleGlyph">G</span>{t('continueGoogle')}
        </button>

        <div className="authDivider"><span>or continue with email</span></div>

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
      <h1>{state.message ? 'Email verified.' : 'Opening your seat…'}</h1>
      {state.busy ? <p>{t('verifying')}</p> : state.message ? <>
        <p>Your one-time link worked. You can log in now.</p>
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
