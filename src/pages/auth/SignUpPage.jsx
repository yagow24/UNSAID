import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredPendingInvite } from '../../hooks/usePendingInvite';
import { GlassLoader } from '../../components/ui/GlassLoader';

/**
 * Public SignUpPage Route Guard
 * Normal users cannot sign up directly from public entry without an invite context.
 * Redirects visitors to the Auth Gateway (/) or to their pending /join/:token route.
 */
export const SignUpPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const pendingInvite = getStoredPendingInvite();
    if (pendingInvite?.token) {
      navigate(`/join/${encodeURIComponent(pendingInvite.token)}`, { replace: true });
    } else {
      navigate('/', {
        replace: true,
        state: {
          reason: 'invite_required',
          message: 'User accounts are created through workspace invitations. Please open the invitation link provided by your workspace administrator.',
        },
      });
    }
  }, [navigate]);

  return <GlassLoader message="Redirecting to workspace invitation gateway..." />;
};

export default SignUpPage;
