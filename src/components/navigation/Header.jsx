import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, Bell, LogOut } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { WorkspaceSwitcher } from '../workspace/WorkspaceSwitcher';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import { WorkspaceRequestsModal } from '../workspace/WorkspaceRequestsModal';
import { NotificationsModal } from '../notification/NotificationsModal';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useNotifications } from '../../hooks/useNotifications';
import { APP_CONFIG } from '../../config/appConfig';


/**
 * Header Component
 * Sticky glassmorphism top navigation bar.
 * Updates dynamically based on authentication state and user/admin privileges.
 */
export const Header = ({ onOpenNotifications }) => {
  const { currentUser, userProfile, isAuthenticated, isAdmin: isPlatformAdmin, signOut } = useAuth();
  const { isCurrentWorkspaceAdmin, currentWorkspace, pendingRequestsCount } = useWorkspace();
  const { unreadCount } = useNotifications();
  const isAdmin = isPlatformAdmin || isCurrentWorkspaceAdmin;
  const navigate = useNavigate();

  const location = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [userNotificationsOpen, setUserNotificationsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('[UNSAID Sign Out Error]', err);
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3.5 transition-all duration-300">
      <div className="max-w-7xl mx-auto glass-nav rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-[var(--shadow)] border border-[var(--glass-border)] relative overflow-visible">
        {/* Header top specular light reflection */}
        <div
          className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--glass-highlight)] to-transparent opacity-80 pointer-events-none rounded-t-full"
          aria-hidden="true"
        />
        {/* Left: Brand Identity & Active Workspace */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            to={isAuthenticated ? (isAdmin ? '/admin' : '/app') : '/'}
            className="flex items-center gap-2.5 group select-none cursor-pointer"
          >
            {/* Logo Mark */}
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[var(--primary)] via-[#8b5cf6] to-[var(--cyan)] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
              <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Title */}
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--text)] group-hover:text-[var(--primary)] transition-colors leading-tight">
                {APP_CONFIG.name}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] tracking-wider uppercase hidden md:inline-block leading-none">
                Query Resolution
              </span>
            </div>
          </Link>

          {/* Workspace Switcher (Visible when Authenticated) */}
          {isAuthenticated && (
            <div className="flex items-center border-l border-[var(--glass-border)] pl-2 sm:pl-3">
              <WorkspaceSwitcher onOpenCreateModal={() => setCreateModalOpen(true)} />
            </div>
          )}
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-1 bg-[var(--surface)] p-1 rounded-full border border-[var(--glass-border)] shadow-inner"
          aria-label="Desktop Navigation"
        >
          {isAuthenticated ? (
            isAdmin ? (
              <>
                <Link
                  to="/admin"
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive('/admin')
                      ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  Admin Control
                </Link>
                {currentWorkspace && (
                  <button
                    type="button"
                    onClick={() => setRequestsModalOpen(true)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      pendingRequestsCount > 0
                        ? 'bg-[var(--cyan)] text-white shadow-sm font-semibold animate-pulse'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                    }`}
                    title="Workspace Join Requests"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Join Requests</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        pendingRequestsCount > 0
                          ? 'bg-white text-[var(--cyan)]'
                          : 'bg-[var(--surface-active)] text-[var(--text-muted)]'
                      }`}
                    >
                      {pendingRequestsCount}
                    </span>
                  </button>
                )}
                <Link
                  to="/workspace"
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive('/workspace')
                      ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  Workspaces
                </Link>
                <Link
                  to="/account"
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive('/account')
                      ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  Account
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/app"
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive('/app')
                      ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  Home
                </Link>
                <Link
                  to="/workspace"
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive('/workspace')
                      ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  Workspaces
                </Link>
                <Link
                  to="/account"
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive('/account')
                      ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  Account
                </Link>
              </>
            )
          ) : (
            <>
              <Link
                to="/"
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive('/') || isActive('/signin') || isActive('/login')
                    ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                }`}
              >
                Admin Sign In
              </Link>
              <Link
                to="/signup"
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive('/signup')
                    ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                }`}
              >
                Create Admin Account
              </Link>
              <Link
                to="/showcase"
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive('/showcase')
                    ? 'bg-[var(--primary)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'
                }`}
              >
                Design System
              </Link>
            </>
          )}
        </nav>

        {/* Right: Actions, Theme Toggle, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? (
            <>
              {/* Role Badge */}
              <Badge variant={isAdmin ? 'cyan' : 'neutral'} size="sm" className="hidden lg:inline-flex">
                {isAdmin ? 'Admin' : 'User'}
              </Badge>

              {/* Notifications Icon: Live Alerts & Join Requests */}
              <IconButton
                icon={
                  <div className="relative">
                    <Bell className="w-4 h-4 text-[var(--text)]" />
                    {(isAdmin ? pendingRequestsCount + unreadCount : unreadCount) > 0 ? (
                      <span className="absolute -top-1.5 -right-2 px-1 py-0.2 min-w-4 h-4 rounded-full bg-[var(--cyan)] text-white text-[9px] font-bold flex items-center justify-center shadow-sm animate-pulse">
                        {isAdmin ? pendingRequestsCount + unreadCount : unreadCount}
                      </span>
                    ) : (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-transparent" />
                    )}
                  </div>
                }
                ariaLabel="Notifications"
                variant="glass"
                size="md"
                onClick={() => {
                  if (isAdmin && pendingRequestsCount > 0 && unreadCount === 0) {
                    setRequestsModalOpen(true);
                  } else if (onOpenNotifications) {
                    onOpenNotifications();
                  } else {
                    setUserNotificationsOpen(true);
                  }
                }}
                className="hidden sm:inline-flex cursor-pointer"
              />

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Profile Avatar Link */}
              <Link to="/account" title="Account settings">
                <Avatar
                  name={userProfile?.fullName || currentUser?.displayName || 'User'}
                  src={
                    userProfile?.avatarPreference === 'initials'
                      ? null
                      : userProfile?.avatarUrl || currentUser?.photoURL
                  }
                  size="md"
                  isOnline={true}
                />
              </Link>

              {/* Sign Out Button */}
              <IconButton
                icon={<LogOut className="w-4 h-4 text-[var(--danger)]" />}
                ariaLabel="Sign Out"
                variant="glass"
                size="md"
                onClick={handleSignOut}
                className="hidden md:inline-flex hover:border-[var(--danger)]"
              />
            </>
          ) : (
            <>
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Admin Portal CTA */}
              <Link to="/">
                <Button variant="primary" size="sm">
                  Admin Sign In
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Admin Workspace Creation Modal */}
      {isAdmin && (
        <CreateWorkspaceModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {/* Admin Workspace Requests Modal */}
      {isAdmin && currentWorkspace && (
        <WorkspaceRequestsModal
          isOpen={requestsModalOpen}
          onClose={() => setRequestsModalOpen(false)}
          workspace={currentWorkspace}
        />
      )}

      {/* User Notifications Modal */}
      <NotificationsModal
        isOpen={userNotificationsOpen}
        onClose={() => setUserNotificationsOpen(false)}
      />
    </header>
  );
};
