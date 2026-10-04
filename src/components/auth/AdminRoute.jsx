import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWorkspace } from '../../hooks/useWorkspace';
import { GlassLoader } from '../ui/GlassLoader';

/**
 * AdminRoute Component
 * Restricts route access to verified platform administrators or current workspace administrators.
 * Non-admin authenticated accounts are securely redirected to /app.
 */
export const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin: isPlatformAdmin, loading: authLoading, userProfile } = useAuth();
  const { isCurrentWorkspaceAdmin, loading: workspaceLoading } = useWorkspace();
  const location = useLocation();

  if (authLoading || (isAuthenticated && !userProfile) || workspaceLoading) {
    return <GlassLoader message="Verifying administrator authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/signin" state={{ from: location }} replace />;
  }

  const hasAdminAccess = isPlatformAdmin || isCurrentWorkspaceAdmin;
  if (!hasAdminAccess) {
    return <Navigate to="/app" replace />;
  }

  return children;
};
