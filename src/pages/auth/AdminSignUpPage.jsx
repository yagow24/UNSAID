import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Link as LinkIcon,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { UnsaidLogoMark } from '../../components/ui/UnsaidLogoMark';
import { getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';
import { APP_CONFIG } from '../../config/appConfig';

/**
 * AdminSignUpPage Component
 * Public application entry for creating an Administrator account.
 * Any email address is permitted. Sets role = 'admin'.
 */
export const AdminSignUpPage = () => {
  const { signUpAsAdmin, signInWithGoogleAsAdmin } = useAuth();
  const { getInviteByToken } = useWorkspace();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Secondary Invitation Lookup State
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [verifyingInvite, setVerifyingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please provide a valid administrator email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify your password confirmation.');
      return;
    }

    setLoading(true);

    try {
      const result = await signUpAsAdmin(email, password, fullName);
      if (result?.user) {
        navigate('/admin', { replace: true });
      }
    } catch (err) {
      console.error('[UNSAID Admin SignUp Error]', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(getFriendlyAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogleAsAdmin();
      if (result?.user) {
        if (result.profile?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate('/app', { replace: true });
        }
      }
    } catch (err) {
      console.error('[UNSAID Admin Google SignUp Error]', err);
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOpenInvite = async (e) => {
    e.preventDefault();
    const raw = inviteTokenInput.trim();
    if (!raw) {
      setInviteError('Please enter an invitation link or token.');
      return;
    }

    setInviteError('');
    setVerifyingInvite(true);

    let token = raw;
    const match = raw.match(/\/join\/([^/?#]+)/i);
    if (match && match[1]) {
      token = match[1];
    } else {
      token = token.replace(/^[/#]+|[/?#].*$/g, '').trim();
    }

    try {
      const res = await getInviteByToken(token);
      if (!res || res.error) {
        if (res?.error === 'expired') {
          setInviteError('This invitation has expired.');
        } else if (res?.error === 'revoked') {
          setInviteError('This invitation has been revoked.');
        } else if (res?.error === 'not_found') {
          setInviteError('This workspace invitation is no longer available.');
        } else {
          setInviteError('Invalid invitation link or token.');
        }
        return;
      }
      navigate(`/join/${encodeURIComponent(token)}`);
    } catch {
      setInviteError('Unable to verify invitation. Please check your connection.');
    } finally {
      setVerifyingInvite(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand & Context Header */}
        <div className="text-center space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 group transition-transform hover:scale-105"
          >
            <div className="relative w-11 h-11 flex items-center justify-center">
              <UnsaidLogoMark className="w-full h-full" showShadow />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {APP_CONFIG.name}
            </span>
          </Link>

          <p className="text-xs uppercase font-semibold tracking-wider text-[var(--text-muted)]">
            Intelligent Query Resolution & Escalation
          </p>

          <div className="flex justify-center pt-0.5">
            <Badge variant="cyan" size="sm" dot className="font-semibold px-3 py-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-[var(--cyan)]" />
              ADMIN ACCESS
            </Badge>
          </div>

          <div className="pt-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
              Create your UNSAID account
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
              Workspace users join through invitation links.
            </p>
          </div>
        </div>

        {/* Primary Registration Card */}
        <GlassCard variant="panel" glow className="p-6 sm:p-8 space-y-5 border border-[var(--glass-border)]">
          {error && (
            <div
              className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-start gap-2.5 animate-fade-in"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-signup-fullname"
                className="block text-xs font-semibold text-[var(--text-secondary)] tracking-wide"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-signup-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-signup-email"
                className="block text-xs font-semibold text-[var(--text-secondary)] tracking-wide"
              >
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-signup-password"
                className="block text-xs font-semibold text-[var(--text-secondary)] tracking-wide"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password (min. 6 characters)"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-full cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-signup-confirm-password"
                className="block text-xs font-semibold text-[var(--text-secondary)] tracking-wide"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-full cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={loading}
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              Create Admin Account
            </Button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--glass-border)]" />
            </div>
            <span className="relative px-3 bg-[var(--surface)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium rounded-full">
              OR
            </span>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            isLoading={googleLoading}
            onClick={handleGoogleSignUp}
            aria-label="Continue with Google"
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            }
          >
            Continue with Google
          </Button>

          {/* Link to Sign In */}
          <div className="pt-3 border-t border-[var(--glass-border)] text-center space-y-2">
            <p className="text-xs text-[var(--text-muted)]">
              Already have an admin account?{' '}
              <Link to="/signin" className="text-[var(--cyan)] font-semibold hover:underline">
                Sign In
              </Link>
            </p>
            <p className="text-[11px] text-[var(--text-muted)] italic">
              Workspace users join through invitation links.
            </p>
          </div>
        </GlassCard>

        {/* Secondary Card: Workspace Invitation Entry */}
        <GlassCard className="p-4 sm:p-5 border border-[var(--glass-border)] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-left">
              <span className="text-xs font-semibold text-[var(--text)] block">
                Have a workspace invitation?
              </span>
              <span className="text-[11px] text-[var(--text-muted)] block">
                Standard members enter via invite link or token.
              </span>
            </div>

            {!showInviteInput && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowInviteInput(true)}
              >
                Join with Invitation
              </Button>
            )}
          </div>

          {showInviteInput && (
            <form onSubmit={handleOpenInvite} className="space-y-2.5 pt-1 animate-fade-in">
              {inviteError && (
                <div className="p-2.5 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={inviteTokenInput}
                    onChange={(e) => setInviteTokenInput(e.target.value)}
                    placeholder="Paste invite link or code"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={verifyingInvite}
                >
                  Join
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowInviteInput(false);
                    setInviteError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default AdminSignUpPage;
