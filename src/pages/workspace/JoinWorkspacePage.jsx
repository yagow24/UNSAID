import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { storePendingInvite } from '../../hooks/usePendingInvite';
import { PageContainer } from '../../components/layout/PageContainer';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { GlassLoader } from '../../components/ui/GlassLoader';
import { getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';
import { subscribeToUserJoinRequest } from '../../services/workspaceRequestService';

const getJoinStatusFromResult = (result) => {
  if (result?.status === 'already_member') return 'member';
  if (result?.status === 'pending') return 'pending';
  if (result?.status === 'rejected') return 'rejected';
  throw new Error('The join request could not be confirmed. Please try again.');
};

export const JoinWorkspacePage = () => {
  const { token, inviteToken } = useParams();
  const effectiveToken = token || inviteToken;

  const navigate = useNavigate();
  const {
    currentUser,
    isAuthenticated,
    loading: authLoading,
    signUpAsInvitedUser,
    signInAsInvitedUser,
    signInWithGoogleAsInvitedUser,
  } = useAuth();

  const {
    getInviteByToken,
    requestJoinWorkspace,
    getUserRequestForWorkspace,
    memberships,
    switchWorkspace,
  } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [workspaceData, setWorkspaceData] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null); // 'expired' | 'revoked' | 'invalid' | 'not_found' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [membershipStatus, setMembershipStatus] = useState(null); // 'member' | 'pending' | 'rejected' | null
  const [submitting, setSubmitting] = useState(false);

  // Authentication State for Unauthenticated Visitors
  const [authTab, setAuthTab] = useState('signup'); // 'signup' | 'signin'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authLoadingAction, setAuthLoadingAction] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // 1. Validate invite token against Firestore
  useEffect(() => {
    let isCancelled = false;

    const fetchInvite = async () => {
      if (!effectiveToken) return;
      setLoading(true);
      setErrorStatus(null);
      setErrorMessage('');

      try {
        const result = await getInviteByToken(effectiveToken);

        if (isCancelled) return;

        if (!result || result.error) {
          setErrorStatus(result?.error || 'invalid');
          setErrorMessage(
            result?.error === 'expired'
              ? 'This workspace invitation has expired.'
              : result?.error === 'revoked'
              ? 'This workspace invitation has been revoked.'
              : result?.error === 'not_found'
              ? 'This workspace invitation is no longer available.'
              : result?.message || 'Invalid or expired invitation link.'
          );
          setLoading(false);
          return;
        }

        setInviteData(result.invite);
        setWorkspaceData(result.workspace);

        // Store invite context safely in sessionStorage for navigation convenience
        storePendingInvite({
          token: effectiveToken,
          workspaceId: result.workspace.id,
          workspaceName: result.workspace.name,
          expiresAt: result.invite.expiresAt,
        });

        // Check relationship for authenticated user
        if (currentUser && result.workspace) {
          const isMember = memberships.some(
            (m) => m.workspaceId === result.workspace.id && m.status === 'active'
          );
          if (isMember) {
            setMembershipStatus('member');
          } else {
            const existingReq = await getUserRequestForWorkspace(result.workspace.id);
            if (existingReq?.status === 'pending') {
              setMembershipStatus('pending');
            } else if (existingReq?.status === 'approved') {
              setMembershipStatus('member');
            } else if (existingReq?.status === 'rejected') {
              setMembershipStatus('rejected');
            } else {
              setMembershipStatus(null);
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[UNSAID Join Page Error]', err);
          setErrorStatus('error');
          setErrorMessage('Failed to verify workspace invitation.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    if (!authLoading) {
      fetchInvite();
    }

    return () => {
      isCancelled = true;
    };
  }, [effectiveToken, currentUser, authLoading, memberships, getInviteByToken, getUserRequestForWorkspace]);

  // Real-time listener for current user's request status for this workspace
  useEffect(() => {
    if (!currentUser?.uid || !workspaceData?.id) return;

    const unsubscribe = subscribeToUserJoinRequest(
      currentUser.uid,
      workspaceData.id,
      (req) => {
        if (req) {
          if (req.status === 'pending') {
            setMembershipStatus('pending');
          } else if (req.status === 'approved') {
            setMembershipStatus('member');
          } else if (req.status === 'rejected') {
            setMembershipStatus('rejected');
          }
        }
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [currentUser?.uid, workspaceData?.id]);

  // Clear authError when user becomes authenticated
  useEffect(() => {
    if (currentUser) {
      queueMicrotask(() => setAuthError(''));
    }
  }, [currentUser]);

  // Request to Join Handler for Authenticated User
  const handleRequestToJoin = async () => {
    setAuthError('');
    setErrorMessage('');

    // 1. Firebase user exists
    if (!currentUser?.uid) {
      setErrorMessage('You must be signed in to submit a join request.');
      return;
    }
    // 2. Invite exists
    if (!inviteData) {
      setErrorMessage('Invite information is missing or not loaded.');
      return;
    }
    // 3. Invite is valid
    if (errorStatus) {
      setErrorMessage(errorMessage || 'This invitation is not valid.');
      return;
    }
    // 4. Invite is not expired
    if (inviteData.expiresAt) {
      const expDate =
        typeof inviteData.expiresAt.toDate === 'function'
          ? inviteData.expiresAt.toDate()
          : new Date(inviteData.expiresAt);
      if (expDate < new Date()) {
        setErrorStatus('expired');
        setErrorMessage('This workspace invitation has expired.');
        return;
      }
    }
    // 5. Invite is not revoked
    if (inviteData.status === 'revoked') {
      setErrorStatus('revoked');
      setErrorMessage('This workspace invitation has been revoked.');
      return;
    }
    // 6. Workspace exists
    if (!workspaceData?.id) {
      setErrorMessage('Target workspace does not exist.');
      return;
    }
    // 7. User is not already an active member
    if (membershipStatus === 'member') {
      setErrorMessage("You're already an active member of this workspace.");
      return;
    }
    // 8. User does not already have a pending request
    if (membershipStatus === 'pending') {
      setErrorMessage('Join request already sent.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await requestJoinWorkspace({
        inviteId: inviteData.id,
        inviteToken: effectiveToken,
        workspaceId: workspaceData.id,
        workspaceName: workspaceData.name,
      });

      setMembershipStatus(getJoinStatusFromResult(res));
    } catch (err) {
      console.error('[UNSAID Request Join Error]', err);
      setErrorMessage(err.message || 'Failed to submit workspace join request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit User Signup through Invite
  const handleUserSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!fullName.trim()) {
      setAuthError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setAuthLoadingAction(true);
    try {
      const res = await signUpAsInvitedUser(email, password, fullName, effectiveToken);
      if (res?.user && workspaceData) {
        await requestJoinWorkspace({
          userId: res.user.uid,
          inviteId: inviteData?.id,
          inviteToken: effectiveToken,
          workspaceId: workspaceData.id,
          workspaceName: workspaceData.name,
        });
        setMembershipStatus('pending');
      }
    } catch (err) {
      console.error('[UNSAID Invited User SignUp Diagnostic]', err);
      const message = getFriendlyAuthErrorMessage(err);
      setAuthError(message);
      setErrorMessage(message);
    } finally {
      setAuthLoadingAction(false);
    }
  };

  // Submit User SignIn through Invite
  const handleUserSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!email.trim() || !password) {
      setAuthError('Please provide both your email and password.');
      return;
    }

    setAuthLoadingAction(true);
    try {
      const res = await signInAsInvitedUser(email, password, effectiveToken);
      if (res?.user && workspaceData) {
        const requestResult = await requestJoinWorkspace({
          userId: res.user.uid,
          inviteId: inviteData?.id,
          inviteToken: effectiveToken,
          workspaceId: workspaceData.id,
          workspaceName: workspaceData.name,
        });
        setMembershipStatus(getJoinStatusFromResult(requestResult));
      }
    } catch (err) {
      console.error('[UNSAID Invited User SignIn Diagnostic]', err);
      const message = getFriendlyAuthErrorMessage(err);
      setAuthError(message);
      setErrorMessage(message);
    } finally {
      setAuthLoadingAction(false);
    }
  };

  // Handle Google Sign In through Invite
  const handleGoogleSignIn = async () => {
    setAuthError('');
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogleAsInvitedUser(effectiveToken);
      if (res?.user && workspaceData) {
        const requestResult = await requestJoinWorkspace({
          userId: res.user.uid,
          inviteId: inviteData?.id,
          inviteToken: effectiveToken,
          workspaceId: workspaceData.id,
          workspaceName: workspaceData.name,
        });
        setMembershipStatus(getJoinStatusFromResult(requestResult));
      }
    } catch (err) {
      console.error('[UNSAID Join Google Sign In Error]', err);
      const message = getFriendlyAuthErrorMessage(err);
      setAuthError(message);
      setErrorMessage(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (workspaceData) {
      switchWorkspace(workspaceData.id);
      navigate('/app', { replace: true });
    }
  };

  if (loading || authLoading) {
    return <GlassLoader message="Verifying workspace invitation..." />;
  }

  return (
    <PageContainer size="sm" className="min-h-[75vh] flex items-center justify-center py-12">
      <div className="w-full max-w-lg space-y-6">
        {/* Error / Inactive State */}
        {errorStatus ? (
          <GlassCard variant="panel" glow className="p-8 text-center space-y-5 border border-[var(--glass-border)]">
            <div className="w-14 h-14 rounded-2xl bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/30 flex items-center justify-center mx-auto">
              {errorStatus === 'revoked' ? (
                <Ban className="w-7 h-7" />
              ) : errorStatus === 'expired' ? (
                <Clock className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-[var(--text)]">
                {errorStatus === 'expired'
                  ? 'Invitation Expired'
                  : errorStatus === 'revoked'
                  ? 'Invitation Revoked'
                  : errorStatus === 'not_found'
                  ? 'Workspace Unavailable'
                  : 'Invalid Invitation'}
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {errorMessage || 'This workspace invitation is no longer available.'}
              </p>
            </div>

            <div className="pt-2">
              <Link to="/">
                <Button variant="secondary" size="md">
                  Return to Home
                </Button>
              </Link>
            </div>
          </GlassCard>
        ) : (
          /* Valid Workspace Preview Card */
          <GlassCard variant="panel" glow className="p-6 sm:p-8 space-y-6 border border-[var(--glass-border)]">
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] flex items-center justify-center text-white shadow-md">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="cyan" size="sm" dot className="font-semibold">
                  INVITATION
                </Badge>
                {workspaceData?.domain && (
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    {workspaceData.domain}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs uppercase font-semibold tracking-wider text-[var(--text-muted)]">
                You've been invited to join
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
                {workspaceData?.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--text-secondary)]">
                <span>Invited by: <strong>{inviteData?.createdByEmail || 'Workspace Administrator'}</strong></span>
              </div>
              {workspaceData?.description && (
                <p className="text-xs text-[var(--text-muted)] italic pt-1">
                  "{workspaceData.description}"
                </p>
              )}
            </div>

            {!isAuthenticated && authError && (
              <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Dynamic Status / Actions Section */}
            {membershipStatus === 'member' ? (
              <div className="p-4 rounded-2xl bg-[var(--success-light)] border border-[var(--success)]/30 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>You're already a member of this workspace.</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  You already hold active access rights. No join request is needed.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={handleOpenWorkspace}
                  iconRight={<ArrowRight className="w-4 h-4" />}
                >
                  Open Workspace
                </Button>
              </div>
            ) : membershipStatus === 'pending' ? (
              <div className="p-4 rounded-2xl bg-[var(--warning-light)] border border-[var(--warning)]/30 space-y-2 animate-fade-in text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--warning)]">
                  <Clock className="w-5 h-5 shrink-0" />
                  <span>Request sent</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Your request is currently awaiting administrative approval. You will gain access once an administrator approves your request.
                </p>
                <div className="pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={true}
                    className="opacity-75 cursor-not-allowed"
                  >
                    Request Pending
                  </Button>
                </div>
              </div>
            ) : membershipStatus === 'rejected' ? (
              <div className="p-4 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 space-y-2 animate-fade-in text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--danger)]">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>Join request rejected.</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  An administrator has rejected this request. Please contact your coordinator.
                </p>
              </div>
            ) : !isAuthenticated ? (
              /* Inline User Authentication Scoped Strictly to this Invite */
              <div className="space-y-4 pt-2">
                {/* Auth Mode Toggle Tabs */}
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('signup');
                      setAuthError('');
                    }}
                    className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                      authTab === 'signup'
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('signin');
                      setAuthError('');
                    }}
                    className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                      authTab === 'signin'
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Sign In
                  </button>
                </div>

                {authTab === 'signup' ? (
                  /* Create Account Form */
                  <form onSubmit={handleUserSignUp} className="space-y-3">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] text-center">
                      Create your workspace user account
                    </p>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your name"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={authLoadingAction}
                      icon={<UserPlus className="w-4 h-4" />}
                    >
                      Create Account & Join
                    </Button>
                  </form>
                ) : (
                  /* Sign In Form */
                  <form onSubmit={handleUserSignIn} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      fullWidth
                      isLoading={authLoadingAction}
                      icon={<LogIn className="w-4 h-4" />}
                    >
                      Sign In & Join
                    </Button>
                  </form>
                )}

                {/* Divider */}
                <div className="relative flex items-center justify-center my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--glass-border)]" />
                  </div>
                  <span className="relative px-2 bg-[var(--surface)] text-[10px] uppercase font-semibold text-[var(--text-muted)] rounded-full">
                    Or continue with
                  </span>
                </div>

                {/* Google Sign In Direct Option */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2 px-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-active)] transition-all cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
                </button>

                <p className="text-[11px] text-[var(--text-muted)] text-center pt-1 italic">
                  Your account will be connected to this workspace.
                </p>
              </div>
            ) : (
              /* Authenticated User Join Action */
              <div className="space-y-3 pt-2">
                {errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={membershipStatus === 'pending' || submitting}
                  isLoading={submitting}
                  onClick={handleRequestToJoin}
                  icon={<UserPlus className="w-4 h-4" />}
                >
                  {membershipStatus === 'pending' ? 'Request sent' : 'Request to Join'}
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                  <span>
                    Requesting access as <strong>{currentUser?.displayName || currentUser?.email}</strong>
                  </span>
                </div>
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </PageContainer>
  );
};

export default JoinWorkspacePage;
