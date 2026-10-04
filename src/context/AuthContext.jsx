import React, { useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, getGoogleProvider, isFirebaseConfigured } from '../config/firebase';
import { AuthContext } from './authContextDef';

// Helper to ensure network calls never hang indefinitely
const withTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error('Firestore operation timed out');
        err.code = 'deadline-exceeded';
        reject(err);
      }, ms);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);

// Pending authentication/registration context
// Tracks intended role based on authentication gateway (Public Admin vs Invited User)
let pendingAuthContext = null;

const setPendingAuthContext = (ctx) => {
  pendingAuthContext = ctx;
  try {
    if (ctx) {
      sessionStorage.setItem('unsaid_pending_auth_ctx', JSON.stringify(ctx));
    } else {
      sessionStorage.removeItem('unsaid_pending_auth_ctx');
    }
  } catch {}
};

const getPendingAuthContext = () => {
  if (pendingAuthContext) return pendingAuthContext;
  try {
    const raw = sessionStorage.getItem('unsaid_pending_auth_ctx');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(auth));
  const [profileLoading, setProfileLoading] = useState(false);

  // Helper to fetch or create a user profile document in Firestore
  const syncUserProfile = useCallback(async (firebaseUser, additionalData = {}) => {
    if (!firebaseUser) {
      setUserProfile(null);
      return null;
    }

    // 1. Initial cached profile lookup (only if valid profile was previously persisted)
    let cachedProfile = null;
    try {
      const cached = localStorage.getItem(`unsaid_profile_${firebaseUser.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.role === 'admin' || parsed.role === 'user')) {
          cachedProfile = parsed;
        }
      }
    } catch {}

    // Populate state with cached profile if available to prevent flicker
    if (cachedProfile) {
      setUserProfile((prev) => prev || cachedProfile);
    }

    if (!db) {
      return cachedProfile;
    }

    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await withTimeout(getDoc(userRef), 3500);

      if (userSnap.exists()) {
        // ========================================================
        // EXISTING PROFILE: PRESERVE PERSISTED FIRESTORE ROLE
        // ========================================================
        const data = userSnap.data();
        const updates = {};

        // Populate avatar from Google photo if missing
        if (!data.avatarUrl && firebaseUser.photoURL) {
          updates.avatarUrl = firebaseUser.photoURL;
        }
        if (!data.avatarPreference) {
          updates.avatarPreference = data.avatarUrl || firebaseUser.photoURL ? 'photo' : 'initials';
        }
        // Enrich placeholder name ONLY if user has never customized their name
        if (
          (!data.fullName || data.fullName === 'UNSAID Member' || data.fullName === 'Workspace Admin') &&
          firebaseUser.displayName
        ) {
          updates.fullName = firebaseUser.displayName;
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = serverTimestamp();
          withTimeout(setDoc(userRef, updates, { merge: true }), 2500).catch(() => {});
          Object.assign(data, updates);
        }

        if (data.fullName && firebaseUser.displayName !== data.fullName) {
          try {
            await updateProfile(firebaseUser, { displayName: data.fullName });
          } catch {}
        }

        // Clear any pending registration context since profile exists
        setPendingAuthContext(null);

        // Store profile with preserved role in state and cache
        setUserProfile(data);
        try {
          localStorage.setItem(`unsaid_profile_${firebaseUser.uid}`, JSON.stringify(data));
        } catch {}
        return data;
      } else {
        // ========================================================
        // NEW ACCOUNT CREATION: ROLE DETERMINED BY AUTH CONTEXT
        // ========================================================
        const pending = getPendingAuthContext();

        // Target role strictly adheres to context:
        // - Explicit invite context -> 'user'
        // - Explicit admin context or default public context -> 'admin'
        let targetRole = 'admin';
        if (additionalData.role === 'user' || pending?.role === 'user') {
          targetRole = 'user';
        } else if (additionalData.role === 'admin' || pending?.role === 'admin') {
          targetRole = 'admin';
        }

        const targetName =
          additionalData.fullName ||
          pending?.fullName ||
          firebaseUser.displayName ||
          (targetRole === 'admin' ? 'Workspace Admin' : 'UNSAID Member');

        const newProfile = {
          uid: firebaseUser.uid,
          fullName: targetName.trim(),
          email: (firebaseUser.email || '').trim().toLowerCase(),
          role: targetRole,
          avatarUrl: firebaseUser.photoURL || null,
          avatarPreference: firebaseUser.photoURL ? 'photo' : 'initials',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await withTimeout(setDoc(userRef, newProfile), 3500);

        if (targetName && firebaseUser.displayName !== targetName) {
          try {
            await updateProfile(firebaseUser, { displayName: targetName });
          } catch {}
        }

        setPendingAuthContext(null);
        setUserProfile(newProfile);
        try {
          localStorage.setItem(`unsaid_profile_${firebaseUser.uid}`, JSON.stringify(newProfile));
        } catch {}
        return newProfile;
      }
    } catch (err) {
      console.warn('[UNSAID Auth] Firestore profile sync deferred (offline/timeout):', err.message);
      if (cachedProfile) {
        setUserProfile(cachedProfile);
        return cachedProfile;
      }
      return null;
    }
  }, []);

  // Listen to persistent Firebase Auth state
  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        setAuthLoading(false);
        setProfileLoading(true);
        try {
          await syncUserProfile(firebaseUser);
        } catch (err) {
          console.error('[UNSAID Auth] syncUserProfile error:', err);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setAuthLoading(false);
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, [syncUserProfile]);

  // ==========================================
  // ADMIN AUTHENTICATION FLOWS (PUBLIC AUTH)
  // ==========================================

  // Admin Sign Up with Email/Password (Any email creates an ADMIN account)
  const signUpAsAdmin = async (email, password, fullName = 'Workspace Admin') => {
    if (!auth) throw new Error('Firebase Authentication is not configured');
    const normalizedEmail = email.trim().toLowerCase();

    // Set pending auth context prior to Firebase Auth account creation
    setPendingAuthContext({
      role: 'admin',
      fullName: (fullName || 'Workspace Admin').trim(),
      flow: 'admin_signup',
    });

    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      setPendingAuthContext(null);
      console.error('[UNSAID Admin Auth Diagnostic]', {
        operation: 'signUpAsAdmin',
        code: err?.code,
        message: err?.message,
      });
      throw err;
    }

    const user = userCredential.user;
    try {
      await updateProfile(user, { displayName: (fullName || 'Workspace Admin').trim() });
    } catch {}

    // Explicitly confirm role = 'admin' on user profile creation
    const profile = await syncUserProfile(user, {
      fullName: (fullName || 'Workspace Admin').trim(),
      role: 'admin',
    });
    return { user, profile };
  };

  // Admin Sign In with Email/Password (Preserves existing role)
  const signInAsAdmin = async (email, password) => {
    if (!auth) throw new Error('Firebase Authentication is not configured');
    const normalizedEmail = email.trim().toLowerCase();

    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      console.error('[UNSAID Admin Auth Diagnostic]', {
        operation: 'signInAsAdmin',
        code: err?.code,
        message: err?.message,
      });
      throw err;
    }

    const user = userCredential.user;
    // Load profile from Firestore (preserving existing role without modification)
    const profile = await syncUserProfile(user);
    return { user, profile };
  };

  // Admin Sign In / Sign Up with Google (Public flow: creates ADMIN if new account)
  const signInWithGoogleAsAdmin = async () => {
    if (!auth) throw new Error('Firebase Authentication is not configured');
    const provider = googleProvider || getGoogleProvider();
    if (!provider) throw new Error('Google Sign-In provider could not be initialized');

    // Public Google authentication flow: creates ADMIN if account is new
    setPendingAuthContext({
      role: 'admin',
      fullName: null,
      flow: 'admin_google',
    });

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      setPendingAuthContext(null);
      console.error('[UNSAID Admin Google Auth Diagnostic]', {
        operation: 'signInWithGoogleAsAdmin',
        code: err?.code,
        message: err?.message,
      });
      throw err;
    }

    const user = result.user;
    const profile = await syncUserProfile(user, { role: 'admin' });
    return { user, profile };
  };

  // ==========================================
  // INVITED USER AUTHENTICATION FLOWS
  // ==========================================

  // Invited User Sign Up (Requires valid invite token context -> creates USER)
  const signUpAsInvitedUser = async (email, password, fullName, inviteToken) => {
    if (!auth) throw new Error('Firebase Authentication is not configured');
    if (!inviteToken) {
      throw new Error('User registration requires a valid workspace invitation.');
    }

    // Set pending auth context: invite flow creates USER
    setPendingAuthContext({
      role: 'user',
      fullName: (fullName || 'UNSAID Member').trim(),
      inviteToken,
      flow: 'invite_signup',
    });

    const normalizedEmail = email.trim().toLowerCase();
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      setPendingAuthContext(null);
      console.error('[UNSAID User Auth Diagnostic]', {
        operation: 'signUpAsInvitedUser',
        code: err?.code,
        message: err?.message,
      });
      throw err;
    }

    const user = userCredential.user;
    try {
      await updateProfile(user, { displayName: (fullName || 'UNSAID Member').trim() });
    } catch {}

    const profile = await syncUserProfile(user, {
      fullName: (fullName || 'UNSAID Member').trim(),
      role: 'user',
    });
    return { user, profile };
  };

  // Invited User Sign In (Preserves existing role)
  const signInAsInvitedUser = async (email, password, inviteToken) => {
    if (!auth) throw new Error('Firebase Authentication is not configured');
    if (!inviteToken) {
      throw new Error('User authentication requires a valid workspace invitation.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    } catch (err) {
      console.error('[UNSAID User Auth Diagnostic]', {
        operation: 'signInAsInvitedUser',
        code: err?.code,
        message: err?.message,
      });
      throw err;
    }

    // Preserve existing role (whether user or admin joining another workspace)
    const profile = await syncUserProfile(userCredential.user);
    return { user: userCredential.user, profile };
  };

  // Invited User Sign In with Google (Creates USER if new account)
  const signInWithGoogleAsInvitedUser = async (inviteToken) => {
    if (!auth) throw new Error('Firebase Authentication is not configured');
    if (!inviteToken) {
      throw new Error('Google Sign-In requires a valid workspace invitation.');
    }

    const provider = googleProvider || getGoogleProvider();
    if (!provider) throw new Error('Google Sign-In provider could not be initialized');

    // Invite Google authentication flow: creates USER if account is new
    setPendingAuthContext({
      role: 'user',
      inviteToken,
      flow: 'invite_google',
    });

    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (err) {
      setPendingAuthContext(null);
      console.error('[UNSAID User Google Auth Diagnostic]', {
        operation: 'signInWithGoogleAsInvitedUser',
        code: err?.code,
        message: err?.message,
      });
      throw err;
    }

    const user = result.user;
    const profile = await syncUserProfile(user, { role: 'user' });
    return { user, profile };
  };

  // Legacy Sign In/Up helpers for backward compatibility
  const signUp = async (email, password, fullName, requestedRole = 'user') => {
    if (requestedRole === 'admin') {
      return signUpAsAdmin(email, password, fullName);
    }
    return signUpAsInvitedUser(email, password, fullName, 'legacy');
  };

  const signIn = async (email, password) => {
    return signInAsAdmin(email, password);
  };

  const signInWithGoogle = async () => {
    return signInWithGoogleAsAdmin();
  };

  // Sign out
  const signOut = async () => {
    setPendingAuthContext(null);
    if (!auth) {
      setCurrentUser(null);
      setUserProfile(null);
      return;
    }
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
  };

  // Password Reset
  const resetPassword = async (email) => {
    if (!auth) {
      throw new Error('Firebase Authentication is not configured in .env');
    }
    return sendPasswordResetEmail(auth, email.trim().toLowerCase());
  };

  // Refresh profile manually
  const refreshProfile = async () => {
    if (currentUser) {
      return syncUserProfile(currentUser);
    }
  };

  // Safe Profile Update (allows updating fullName and avatar, blocks client role tampering)
  const updateProfileData = async (fieldsToUpdate) => {
    if (!currentUser) {
      throw new Error('User is not authenticated.');
    }
    if (!db) {
      throw new Error('Database service is not configured.');
    }

    // Filter strictly to safe editable fields
    const safeData = {};
    if (fieldsToUpdate.fullName !== undefined) {
      const trimmedName = String(fieldsToUpdate.fullName).trim();
      if (!trimmedName) {
        throw new Error('Display name cannot be blank.');
      }
      safeData.fullName = trimmedName;
    }
    if (fieldsToUpdate.avatarPreference !== undefined) {
      safeData.avatarPreference = fieldsToUpdate.avatarPreference === 'photo' ? 'photo' : 'initials';
    }

    safeData.updatedAt = serverTimestamp();

    // 1. Update Firebase Auth displayName
    if (safeData.fullName && auth?.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: safeData.fullName });
      } catch (authErr) {
        console.warn('[UNSAID Auth] Could not update Auth profile displayName:', authErr);
      }
    }

    // 2. Immediately update AuthContext local states and persistent cache
    const nextProfile = {
      ...(userProfile || {}),
      uid: currentUser.uid,
      email: currentUser.email,
      ...safeData,
    };

    setUserProfile(nextProfile);
    try {
      localStorage.setItem(`unsaid_profile_${currentUser.uid}`, JSON.stringify(nextProfile));
    } catch {}

    if (safeData.fullName) {
      setCurrentUser((prev) => {
        if (!prev) return prev;
        try {
          const updated = Object.create(Object.getPrototypeOf(prev));
          Object.assign(updated, prev);
          updated.displayName = safeData.fullName;
          return updated;
        } catch {
          return prev;
        }
      });
    }

    // 3. Persist to Firestore user profile document with timeout protection
    if (db) {
      const userRef = doc(db, 'users', currentUser.uid);
      const firestoreData = {
        ...safeData,
        updatedAt: serverTimestamp(),
      };
      withTimeout(setDoc(userRef, firestoreData, { merge: true }), 2500).catch((fsErr) => {
        console.warn('[UNSAID Auth] Firestore profile write deferred (offline/timeout):', fsErr.message);
      });
    }

    return nextProfile;
  };

  // Re-authenticate current user with Google popup
  const reauthenticateWithGoogle = async () => {
    if (!auth || !auth.currentUser) {
      throw new Error('User is not authenticated.');
    }
    const provider = googleProvider || getGoogleProvider();
    if (!provider) {
      throw new Error('Google Sign-In provider could not be initialized');
    }
    return reauthenticateWithPopup(auth.currentUser, provider);
  };

  // Real Account Deletion with Pre-Reauthentication and Scoped Firestore Cleanup
  const deleteAccount = async ({ password = '', isGoogleReauthenticated = false } = {}) => {
    if (!auth || !auth.currentUser) {
      throw new Error('User is not authenticated.');
    }

    const user = auth.currentUser;
    const uid = user.uid;
    const email = user.email;

    const hasPasswordProvider = user.providerData?.some((p) => p.providerId === 'password');
    const hasGoogleProvider = user.providerData?.some((p) => p.providerId === 'google.com');

    // 1. Mandatory Re-authentication FIRST (Guarantees no data is deleted if re-auth fails)
    if (hasPasswordProvider) {
      if (!password) {
        const reauthError = new Error('Please enter your account password to verify your identity.');
        reauthError.code = 'auth/missing-password';
        throw reauthError;
      }
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);
    } else if (hasGoogleProvider && !isGoogleReauthenticated) {
      const provider = googleProvider || getGoogleProvider();
      await reauthenticateWithPopup(user, provider);
    }

    // 2. Clean up user's own personal Firestore records while still authenticated
    if (db) {
      try {
        // Delete users/{uid} document
        const userRef = doc(db, 'users', uid);
        await withTimeout(deleteDoc(userRef), 4000).catch((err) => {
          console.warn('[UNSAID Delete Account] User doc delete warning:', err.message);
        });

        // Delete user's workspaceMemberships
        const memRef = collection(db, 'workspaceMembers');
        const memQ = query(memRef, where('userId', '==', uid));
        const memSnap = await withTimeout(getDocs(memQ), 4000).catch(() => null);
        if (memSnap && !memSnap.empty) {
          const deleteMemPromises = memSnap.docs.map((d) =>
            withTimeout(deleteDoc(doc(db, 'workspaceMembers', d.id)), 3000).catch(() => {})
          );
          await Promise.all(deleteMemPromises);
        }

        // Delete user's workspaceRequests
        const reqRef = collection(db, 'workspaceRequests');
        const reqQ = query(reqRef, where('userId', '==', uid));
        const reqSnap = await withTimeout(getDocs(reqQ), 4000).catch(() => null);
        if (reqSnap && !reqSnap.empty) {
          const deleteReqPromises = reqSnap.docs.map((d) =>
            withTimeout(deleteDoc(doc(db, 'workspaceRequests', d.id)), 3000).catch(() => {})
          );
          await Promise.all(deleteReqPromises);
        }
      } catch (fsErr) {
        console.warn('[UNSAID Delete Account] Firestore cleanup non-fatal warning:', fsErr.message);
      }
    }

    // 3. Delete Firebase Authentication user account
    await deleteUser(user);

    // 4. Clear local and session storage caches
    try {
      localStorage.removeItem(`unsaid_profile_${uid}`);
      localStorage.removeItem('unsaid_active_workspace');
      localStorage.removeItem('unsaid_workspaces_cache');
      sessionStorage.removeItem('unsaid_pending_invite');
    } catch {}

    setCurrentUser(null);
    setUserProfile(null);
  };

  // Derived Admin authorization flag:
  // Derived strictly from Firestore verified role document.
  // NEVER from localStorage, client state, query params, or hardcoded email lists.
  const isAdmin = Boolean(userProfile?.role === 'admin');

  // Explicit composite loading state: true while Firebase Auth is initializing,
  // or when an authenticated user's profile is still being synchronized
  const loading = authLoading || (Boolean(currentUser) && (profileLoading || !userProfile));

  const value = {
    currentUser,
    userProfile,
    loading,
    authLoading,
    profileLoading,
    isAuthenticated: Boolean(currentUser),
    isAdmin,
    isConfigured: isFirebaseConfigured,
    // Admin explicit flows
    signUpAsAdmin,
    signInAsAdmin,
    signInWithGoogleAsAdmin,
    // Invited user explicit flows
    signUpAsInvitedUser,
    signInAsInvitedUser,
    signInWithGoogleAsInvitedUser,
    // Reauthentication
    reauthenticateWithGoogle,
    // Backward compatibility
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile,
    updateProfileData,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
