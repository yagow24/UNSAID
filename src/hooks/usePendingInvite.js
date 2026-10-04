import { useState, useCallback } from 'react';

const PENDING_INVITE_KEY = 'unsaid_pending_invite';

/**
 * Reads pending invitation context safely from client sessionStorage.
 * Used strictly for temporary navigation convenience, NEVER for backend authorization.
 */
export const getStoredPendingInvite = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Stores pending invitation context safely in client sessionStorage.
 */
export const storePendingInvite = (inviteData) => {
  if (typeof window === 'undefined' || !inviteData) return;
  try {
    sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(inviteData));
  } catch {}
};

/**
 * Clears pending invitation context from sessionStorage.
 */
export const clearStoredPendingInvite = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}
};

/**
 * React hook for consuming and updating pending invite state.
 */
export const usePendingInvite = () => {
  const [pendingInvite, setPendingInviteState] = useState(() => getStoredPendingInvite());

  const saveInvite = useCallback((data) => {
    storePendingInvite(data);
    setPendingInviteState(data);
  }, []);

  const removeInvite = useCallback(() => {
    clearStoredPendingInvite();
    setPendingInviteState(null);
  }, []);

  return {
    pendingInvite,
    saveInvite,
    removeInvite,
    hasPendingInvite: Boolean(pendingInvite?.token),
  };
};

export default usePendingInvite;
