import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { GlassLoader } from '../ui/GlassLoader';

/**
 * AuthRoute Component
 * Wraps public authentication pages (/login, /signup, /forgot-password).
 * If the user is already authenticated, redirects them straight to their authorized home.
 */
export const AuthRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading, userProfile } = useAuth();
  const location = useLocation();

  if (loading || (isAuthenticated && !userProfile)) {
    return <GlassLoader message="Checking authentication status..." />;
  }

  if (isAuthenticated) {
    // If user was redirected here from a protected page, send them back there
    const destination = location.state?.from?.pathname || (isAdmin ? '/admin' : '/app');
    return <Navigate to={destination} replace />;
  }

  return children;
};
