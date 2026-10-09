import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Button, Field, Input, IconButton, Alert } from '../components/ui';
import PageLoader from '../components/PageLoader';

// Both screens of the reset flow live here because they are two halves of
// one journey and share a shell. Before this existed, "Forgot password?" on
// the sign-in screen was an href="#" with nothing behind it.

const EyeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const MIN_PASSWORD_LENGTH = 8;

/** The card both screens sit in — matches Login's right-hand panel. */
function AuthShell({ icon, title, subtitle, children }) {
  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-10 bg-paper-300 dark:bg-ink-50">
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary w-full max-w-[440px] my-auto p-8 sm:p-10 anim-enter">
        <div className="w-11 h-11 rounded-chip bg-brand-500 shadow-raised flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-white [--icon-size:22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        <h1 className="text-[22px] font-semibold text-foreground leading-tight mb-1.5">{title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// /forgot-password
// ─────────────────────────────────────────────────────────────────────────
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      // A 503 here means the server has no mail credentials — an operator
      // problem worth stating, not a dead end to hide behind the generic
      // confirmation.
      setError(err.response?.data?.error || 'Could not send the reset link. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        icon="mark_email_read"
        title="Check your email"
        subtitle={<>If <strong className="text-foreground">{email.trim()}</strong> has an account, a reset link is on its way. It expires in 60 minutes and works once.</>}
      >
        <Alert tone="info">
          Nothing arrived? Check spam, or confirm you signed in with that address. Accounts that
          use Google sign-in don't have a password to reset — use Continue with Google instead.
        </Alert>
        <Button as={Link} to="/login" variant="secondary" fullWidth className="mt-6" icon="arrow_back">
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon="key"
      title="Reset your password"
      subtitle="Enter the email you sign in with and we'll send you a link to set a new password."
    >
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert tone="negative">{error}</Alert>}
        <Field label="Work email" htmlFor="reset-email">
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            required
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={sending} disabled={!email.trim()}>
          {sending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <div className="text-center mt-5">
        <Link to="/login" className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// /reset-password/:token
// ─────────────────────────────────────────────────────────────────────────
export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loginWithTokens, refreshWorkspaces } = useAuth();

  // The link is checked before the form is shown, so a dead link is caught
  // up front instead of after someone has typed a new password twice.
  const [checking, setChecking] = useState(true);
  const [linkState, setLinkState] = useState({ valid: false, email: null, error: null });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/auth/reset-password/${token}`);
        if (!cancelled) setLinkState({ valid: true, email: data.email, error: null });
      } catch (err) {
        if (!cancelled) {
          setLinkState({
            valid: false,
            email: null,
            error: err.response?.data?.error || 'This reset link is not valid.',
          });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_PASSWORD_LENGTH && password === confirm && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/api/auth/reset-password', { token, password });
      // Signed straight in — bouncing someone who just proved control of the
      // mailbox back to a login form to retype what they set a second ago is
      // a step for nobody's benefit.
      loginWithTokens(data.accessToken, data.refreshToken, data.user, []);
      await refreshWorkspaces();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your password. Please try again.');
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-300 dark:bg-ink-50">
        <PageLoader text="Checking your reset link…" />
      </div>
    );
  }

  if (!linkState.valid) {
    return (
      <AuthShell
        icon="lock"
        title="This link has expired"
        subtitle={linkState.error}
      >
        <Alert tone="info">
          Reset links last 60 minutes and can only be used once. Request a fresh one and it'll
          work straight away.
        </Alert>
        <Button as={Link} to="/forgot-password" size="lg" fullWidth className="mt-6">
          Request a new link
        </Button>
        <div className="text-center mt-5">
          <Link to="/login" className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon="lock"
      title="Set a new password"
      subtitle={<>Signing in as <strong className="text-foreground">{linkState.email}</strong>. Use at least {MIN_PASSWORD_LENGTH} characters.</>}
    >
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert tone="negative">{error}</Alert>}

        <Field
          label="New password"
          htmlFor="new-password"
          error={tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
        >
          <Input
            id="new-password"
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
            required
            trailing={
              <IconButton
                size="sm"
                type="button"
                title={showPwd ? 'Hide password' : 'Show password'}
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </IconButton>
            }
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="confirm-password"
          error={mismatch ? "Both passwords need to match." : undefined}
        >
          <Input
            id="confirm-password"
            type={showPwd ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </Field>

        <Button type="submit" size="lg" fullWidth loading={saving} disabled={!canSubmit}>
          {saving ? 'Saving…' : 'Save and sign in'}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-5 leading-relaxed">
        Saving signs out every other device, in case someone else had access.
      </p>
    </AuthShell>
  );
}
