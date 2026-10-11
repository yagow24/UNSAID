import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Firebase Client Configuration
 * Credentials are read exclusively from environment variables.
 */
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Checks whether Firebase environment credentials have been populated with real values.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_api_key_here' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id'
);

// Initialize Firebase App singleton safely
let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;

try {
  if (isFirebaseConfigured) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    googleProvider.addScope('email');
    googleProvider.addScope('profile');

    try {
      db = getFirestore(app);
    } catch (firestoreError) {
      console.error('[UNSAID] Failed to initialize Firestore:', firestoreError);
    }

    try {
      storage = getStorage(app);
    } catch (storageError) {
      console.warn('[UNSAID] Failed to initialize Firebase Storage:', storageError);
    }
  } else {
    // When environment variables are not yet configured, initialize with safe mock structure
    // so the application UI mounts cleanly with an informational banner.
    console.info(
      '[UNSAID] Firebase environment variables not detected in .env. Copy .env.example to .env and insert your Firebase project keys.'
    );
  }
} catch (error) {
  console.error('[UNSAID] Failed to initialize Firebase:', error);
}

/**
 * Returns the GoogleAuthProvider instance, initializing it if necessary.
 */
export const getGoogleProvider = () => {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
  }
  return googleProvider;
};

export { app, auth, db, storage, googleProvider };

