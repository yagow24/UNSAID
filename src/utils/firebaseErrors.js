/**
 * Firebase Error Mapper
 * Transforms raw Firebase Auth and Firestore error codes into clean, user-friendly messages.
 */

export const getFriendlyAuthErrorMessage = (error) => {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const rawMessage = typeof error === 'string' ? error : error.message || '';
  // Extract Firebase error code from error.code or from embedded "(auth/code)" string
  const code =
    error.code ||
    rawMessage.match(/auth\/[a-z0-9-]+/i)?.[0]?.toLowerCase() ||
    '';

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';

  switch (code) {
    case 'auth/configuration-not-found':
      return 'Authentication is not yet enabled for this Firebase project. Please enable Email/Password in the Firebase Console (Authentication > Sign-in method).';

    case 'auth/unauthorized-domain':
      return `This domain ("${currentHost}") is not authorized for Firebase Authentication. If running locally, open http://localhost:5173 or add "${currentHost}" to Firebase Console > Authentication > Settings > Authorized domains.`;

    case 'auth/popup-closed-by-user':
      return 'Google verification was cancelled.';

    case 'auth/popup-blocked':
      return 'Your browser blocked the Google verification popup. Please allow popups and try again.';

    case 'auth/user-mismatch':
      return 'The Google account used for verification does not match this account.';

    case 'auth/cancelled-popup-request':
      return 'Only one sign-in popup can be active at a time. The previous request was canceled.';

    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email address using a different sign-in method. Please sign in with your email and password.';

    case 'auth/credential-already-in-use':
      return 'This Google account is already linked to another user profile.';

    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.';

    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';

    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please check your credentials and try again.';

    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';

    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes before trying again.';

    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and try again.';

    case 'auth/requires-recent-login':
      return 'This sensitive action requires fresh authentication. Please enter your password or re-authenticate.';

    case 'auth/user-token-expired':
      return 'Your authentication session has expired. Please sign in again.';

    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase API key is missing or invalid. Please check your .env configuration.';

    case 'auth/app-not-authorized':
      return 'This application domain is not authorized to use Firebase Authentication with the provided API key.';

    case 'auth/internal-error':
      return 'An internal Firebase Authentication error occurred. Please try again.';

    case 'permission-denied':
      return 'You do not have permission to access or modify this resource.';

    case 'unavailable':
      return 'The service is temporarily unavailable. Please try again in a moment.';

    default:
      if (rawMessage.includes('API key not valid') || rawMessage.includes('invalid-api-key')) {
        return 'Firebase API key is missing or invalid. Please check your .env configuration.';
      }
      if (rawMessage.includes('unauthorized-domain')) {
        return `This domain ("${currentHost}") is not authorized for Firebase Authentication. If running locally, open http://localhost:5173 or add "${currentHost}" to Firebase Console > Authentication > Settings > Authorized domains.`;
      }
      if (rawMessage.includes('popup-closed')) {
        return 'Google sign-in was canceled because the popup window was closed before completion.';
      }
      if (rawMessage.includes('popup-blocked')) {
        return 'The sign-in popup was blocked by your browser. Please allow popups for this site.';
      }

      const cleaned = rawMessage
        .replace(/Firebase: /i, '')
        .replace(/\(auth\/[^)]+\)\.?/i, '')
        .replace(/\bError\b\.?/i, '')
        .trim();

      if (cleaned && cleaned.length > 3) {
        return cleaned;
      }

      if (code) {
        return `Authentication failed (${code}). Please check your configuration and try again.`;
      }

      return 'Authentication failed. Please check your network connection and configuration, then try again.';
  }
};

/**
 * Transforms raw Firestore / general database errors into user-friendly messages.
 * Prevents raw stack traces and Firebase exception codes from leaking to the UI.
 *
 * @param {Error|Object|string} error
 * @param {string} [defaultFallback='Operation failed. Please try again.']
 * @returns {string}
 */
export const getFriendlyFirestoreErrorMessage = (
  error,
  defaultFallback = 'Operation failed. Please try again.'
) => {
  if (!error) return defaultFallback;

  const rawMessage = typeof error === 'string' ? error : error.message || '';
  const code = error.code || '';

  if (
    code === 'permission-denied' ||
    rawMessage.includes('permission-denied') ||
    rawMessage.includes('insufficient permissions') ||
    rawMessage.includes('Missing or insufficient permissions')
  ) {
    return 'You do not have administrative permission to perform this action.';
  }

  if (
    code === 'unavailable' ||
    rawMessage.includes('unavailable') ||
    rawMessage.includes('network') ||
    rawMessage.includes('Failed to fetch')
  ) {
    return 'Service connection error. Please check your internet connection and try again.';
  }

  if (code === 'unauthenticated' || rawMessage.includes('unauthenticated')) {
    return 'Your session has expired. Please sign in again.';
  }

  if (
    code === 'deadline-exceeded' ||
    rawMessage.includes('deadline-exceeded') ||
    rawMessage.includes('timed out') ||
    rawMessage.includes('timeout')
  ) {
    return 'The request timed out. Please verify Cloud Firestore is enabled in Firebase Console and check your connection.';
  }

  if (code === 'not-found' || rawMessage.includes('not-found')) {
    return 'The requested record could not be found.';
  }

  if (code === 'already-exists' || rawMessage.includes('already-exists')) {
    return 'A record with this identifier already exists.';
  }

  return defaultFallback;
};


