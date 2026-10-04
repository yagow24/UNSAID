import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GlassLoader } from '../ui/GlassLoader';

/**
 * ProtectedRoute Component
 * Guards routes requiring an authenticated user.
 * Redirects unauthenticated visits to /login.
 */
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading, userProfile } = useAuth();
  const location = useLocation();

  if (loading || (isAuthenticated && !userProfile)) {
    return <GlassLoader message="Preparing your workspace..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location, reason: 'login_required' }} replace />;
  }

  // If authenticated admin attempts to open regular user /app feed, route to /admin
  if (isAdmin && location.pathname === '/app') {
    return <Navigate to="/admin" replace />;
  }

  return children;
};
