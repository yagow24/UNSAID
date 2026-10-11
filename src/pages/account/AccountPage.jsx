import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Building2,
  LogOut,
  AlertTriangle,
  Trash2,
  AlertCircle,
  Briefcase,
  GraduationCap,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { PageContainer } from '../../components/layout/PageContainer';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { ModalShell } from '../../components/ui/ModalShell';
import { DynamicProfileForm } from '../../components/profile/DynamicProfileForm';
import { ProfileBadge } from '../../components/profile/ProfileBadge';
import { ProfileCompletionBanner } from '../../components/profile/ProfileCompletionBanner';
import { getEffectiveProfile, isProfileComplete } from '../../services/profileService';
import { getFriendlyFirestoreErrorMessage, getFriendlyAuthErrorMessage } from '../../utils/firebaseErrors';

export const AccountPage = () => {
  const {
    currentUser,
    userProfile,
    isAdmin,
    signOut,
    updateProfileData,
    deleteAccount,
    reauthenticateWithGoogle,
  } = useAuth();
  const { currentWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();

  // UX save flow: 'idle' (Save) -> 'saving' (Saving...) -> 'saved' (Saved) -> 'idle'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active workspace profile resolution
  const effectiveProfile = useMemo(() => {
    return getEffectiveProfile(userProfile, currentWorkspace?.id);
  }, [userProfile, currentWorkspace?.id]);

  const profileComplete = useMemo(() => {
    return isProfileComplete(effectiveProfile);
  }, [effectiveProfile]);

  const handleSaveProfile = async ({ data, workspaceId, asDefault }) => {
    if (saveStatus === 'saving') return;

    setError('');
    setSuccessMessage('');
    setSaveStatus('saving');

    try {
      await updateProfileData(data, { workspaceId, asDefault });
      setSaveStatus('saved');
      setSuccessMessage('Profile saved and updated successfully!');
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('[UNSAID Profile Save Error]', err);
      setError(getFriendlyFirestoreErrorMessage(err, "Profile couldn't be updated. Please try again."));
      setSaveStatus('idle');
    }
  };

  // Delete Account States & Provider Detection
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVerifyingGoogle, setIsVerifyingGoogle] = useState(false);
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const hasPasswordProvider = currentUser?.providerData?.some((p) => p.providerId === 'password');
  const hasGoogleProvider = currentUser?.providerData?.some((p) => p.providerId === 'google.com');

  const isGoogleAccount = hasGoogleProvider && !hasPasswordProvider;
  const isPasswordAccount = hasPasswordProvider || !hasGoogleProvider;

  const executeDelete = async (options) => {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteAccount(options);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('[UNSAID Delete Account Error]', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setDeleteError('Google verification was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        setDeleteError('Your browser blocked the Google verification popup. Please allow popups and try again.');
      } else if (err.code === 'auth/user-mismatch') {
        setDeleteError('The Google account used for verification does not match this account.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password. Please verify your current account password.');
      } else {
        setDeleteError(getFriendlyAuthErrorMessage(err));
      }
      setIsDeleting(false);
    }
  };

  const handleGoogleVerify = async () => {
    setDeleteError('');
    setIsVerifyingGoogle(true);
    try {
      await reauthenticateWithGoogle();
      setIsGoogleVerified(true);
      if (deleteConfirmText.trim() === 'DELETE') {
        await executeDelete({ isGoogleReauthenticated: true });
      }
    } catch (err) {
      console.error('[UNSAID Google Reauth Error]', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setDeleteError('Google verification was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        setDeleteError('Your browser blocked the Google verification popup. Please allow popups and try again.');
      } else if (err.code === 'auth/user-mismatch') {
        setDeleteError('The Google account used for verification does not match this account.');
      } else {
        setDeleteError(getFriendlyAuthErrorMessage(err));
      }
    } finally {
      setIsVerifyingGoogle(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type DELETE exactly to confirm.');
      return;
    }
    if (isPasswordAccount && !reauthPassword) {
      setDeleteError('Please enter your account password to verify your identity.');
      return;
    }
    if (isGoogleAccount && !isGoogleVerified) {
      setDeleteError('Please continue with Google to verify your identity before deleting your account.');
      return;
    }

    await executeDelete({
      password: reauthPassword,
      isGoogleReauthenticated: isGoogleVerified,
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[UNSAID Sign Out Error]', err);
    }
  };

  const formattedJoinDate = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Active Session';

  return (
    <PageContainer size="lg" className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Account & Dynamic Profile"
        subtitle="Manage personal, institutional, and workspace identity settings. Form adapts dynamically."
        badge={
          <Badge variant={isAdmin ? 'cyan' : 'primary'} size="sm" dot>
            {isAdmin ? 'Platform Administrator' : 'Standard Member'}
          </Badge>
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            icon={<LogOut className="w-4 h-4 text-[var(--danger)]" />}
            className="hover:border-[var(--danger)]"
          >
            Sign Out
          </Button>
        }
      />

      {/* Completion Banner if Incomplete */}
      <ProfileCompletionBanner
        profile={effectiveProfile}
        isAdmin={isAdmin}
      />

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Identity Cards) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Identity Overview Card */}
          <GlassCard className="p-6 text-center space-y-4 flex flex-col items-center justify-center">
            <Avatar
              name={effectiveProfile?.fullName || currentUser?.displayName || 'User'}
              src={effectiveProfile?.avatarPreference === 'initials' ? null : (effectiveProfile?.avatarUrl || currentUser?.photoURL)}
              size="lg"
              isOnline={true}
            />

            <div className="space-y-1 w-full px-2">
              <h3 className="text-base font-bold text-[var(--text)] truncate">
                {effectiveProfile?.fullName || currentUser?.displayName || 'Member'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {currentUser?.email}
              </p>
            </div>

            {/* Compact Professional / Academic Profile Badge */}
            <div className="pt-1 flex flex-col items-center gap-1.5 w-full">
              <ProfileBadge profile={effectiveProfile} fallback="Profile pending setup" />

              <div className="flex items-center gap-1.5 pt-1 flex-wrap justify-center">
                <Badge
                  variant={profileComplete ? 'low' : 'warning'}
                  size="xs"
                  dot
                >
                  {profileComplete ? 'Profile Complete' : 'Profile Incomplete'}
                </Badge>
                <Badge variant={isAdmin ? 'cyan' : 'neutral'} size="xs">
                  {isAdmin ? 'Admin Auth' : 'Member Auth'}
                </Badge>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--glass-border)] w-full flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Workspaces:</span>
              <strong className="text-[var(--text)]">{workspaces.length}</strong>
            </div>

            <div className="w-full flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Member Since:</span>
              <strong className="text-[var(--text)]">{formattedJoinDate}</strong>
            </div>
          </GlassCard>

          {/* Active Workspace Status Card */}
          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[var(--cyan)]" />
                <span>Active Workspace</span>
              </h4>
              {effectiveProfile?.isWorkspaceSpecific && (
                <Badge variant="cyan" size="xs">
                  Customized for this WS
                </Badge>
              )}
            </div>

            {currentWorkspace ? (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-[var(--text)]">
                      {currentWorkspace.name}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                      {currentWorkspace.description || 'No description provided.'}
                    </p>
                  </div>
                  <Badge variant="low" size="xs">
                    Connected
                  </Badge>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                  <span className="uppercase tracking-wider font-semibold text-[var(--cyan)]">
                    {currentWorkspace.domain}
                  </span>
                  <span>·</span>
                  <span>Domain verified</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text-muted)] text-center">
                No active workspace selected.
              </div>
            )}

            {workspaces.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Switch Active Workspace:
                </label>
                <select
                  value={currentWorkspace?.id || ''}
                  onChange={(e) => switchWorkspace && switchWorkspace(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id} className="bg-[var(--surface)] text-[var(--text)]">
                      {ws.name} ({ws.domain})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </GlassCard>

          {/* Security & Access Info Card */}
          <GlassCard className="p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Permission Security</span>
            </h4>
            <div className="text-xs text-[var(--text-muted)] space-y-2 leading-relaxed">
              <p>
                Your <strong className="text-[var(--text)]">Server Permission Role</strong> ({isAdmin ? 'Administrator' : 'Member'}) is governed strictly by server authorization and cannot be changed by profile modifications.
              </p>
              <p>
                Your <strong className="text-[var(--text)]">Professional Role</strong> ({effectiveProfile?.professionalRole || 'Unset'}) provides descriptive academic/corporate context to your team.
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Dynamic Profile Settings Form */}
        <div className="lg:col-span-8 space-y-6">
          <GlassCard variant="panel" className="p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--glass-border)] flex-wrap gap-2">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  {isAdmin ? (
                    <Briefcase className="w-4 h-4 text-[var(--cyan)]" />
                  ) : (
                    <GraduationCap className="w-4 h-4 text-[var(--primary)]" />
                  )}
                  <span>{isAdmin ? 'Administrator Profile Details' : 'Member Profile Details'}</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  The form below adapts dynamically based on your selected role.
                </p>
              </div>

              {effectiveProfile?.isWorkspaceSpecific && (
                <Badge variant="cyan" size="sm">
                  Active WS: {currentWorkspace?.name}
                </Badge>
              )}
            </div>

            {/* Dynamic Profile Form Component */}
            <DynamicProfileForm
              isAdmin={isAdmin}
              currentUser={currentUser}
              initialData={effectiveProfile || {}}
              activeWorkspace={currentWorkspace}
              onSave={handleSaveProfile}
              isSaving={saveStatus === 'saving'}
              error={error}
              successMessage={successMessage}
            />
          </GlassCard>

          {/* Danger Zone: Delete Account */}
          <GlassCard className="p-6 border-l-4 border-l-[var(--danger)] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[var(--danger)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Delete Account</span>
                </h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Permanently delete your UNSAID user account and revoke access to all workspaces. This action is irreversible.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setDeleteConfirmText('');
                  setReauthPassword('');
                  setDeleteError('');
                  setIsDeleteModalOpen(true);
                }}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Account
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <ModalShell
          isOpen={isDeleteModalOpen}
          onClose={isDeleting ? undefined : () => setIsDeleteModalOpen(false)}
          title="Delete Account Permanently"
          description="Confirm permanent deletion of your UNSAID account."
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Warning: Permanent Action</span>
                <p className="text-[11px] leading-relaxed">
                  This will delete your credentials and remove your memberships across all workspaces. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/40 text-[var(--danger)] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {isPasswordAccount && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Verify Account Password
                </label>
                <input
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--danger)]"
                />
              </div>
            )}

            {isGoogleAccount && (
              <div className="space-y-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-center">
                <span className="text-[11px] text-[var(--text-muted)] block">
                  This account was created via Google Sign-In. Verification with Google is required.
                </span>
                <Button
                  type="button"
                  variant={isGoogleVerified ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={handleGoogleVerify}
                  isLoading={isVerifyingGoogle}
                  disabled={isVerifyingGoogle || isGoogleVerified}
                >
                  {isGoogleVerified ? 'Google Identity Verified' : 'Verify with Google'}
                </Button>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                Type <strong className="text-[var(--danger)] font-mono">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--danger)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAccount}
                isLoading={isDeleting}
                disabled={isDeleting || deleteConfirmText.trim() !== 'DELETE'}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </PageContainer>
  );
};
