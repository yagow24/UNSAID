/**
 * Admin Security Configuration
 * 
 * ARCHITECTURE RULES:
 * 1. Public Authentication Context (/signup, public Google) creates ADMIN accounts.
 * 2. Invitation Authentication Context (/join/:inviteToken) creates USER accounts.
 * 3. Role authorization is strictly determined by authentication context on creation
 *    and persisted in Cloud Firestore (users/{uid}.role).
 * 4. Never determine admin privileges using hardcoded email strings or email allowlists.
 */

/**
 * Validates whether a user profile has administrator privileges based on persisted Firestore role.
 * @param {object} userProfile
 * @returns {boolean}
 */
export const isVerifiedAdmin = (userProfile) => {
  return Boolean(userProfile && userProfile.role === 'admin');
};

// Deprecated: Maintained as dummy export for any backward compatibility imports
export const AUTHORIZED_ADMIN_EMAILS = [];
export const isAuthorizedAdminEmail = () => false;

