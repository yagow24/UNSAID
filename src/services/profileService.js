/**
 * UNSAID — Professional & Academic Profile Service
 * Manages dynamic roles, validation, workspace-scoped profiles, and persistence.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { fileToCompressedDataUrl, validateImageFile } from './storageService.js';

// Network timeout helper to prevent hung promises
const withTimeout = (promise, ms = 7000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error('Profile save operation timed out. Please check your network connection.');
        err.code = 'deadline-exceeded';
        reject(err);
      }, ms);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);

// ============================================================================
// 1. ROLE DEFINITIONS & CONFIGURATION
// ============================================================================

export const ADMIN_PROFESSIONAL_ROLES = [
  'Teacher',
  'Professor',
  'Lecturer',
  'HOD',
  'Principal',
  'School Administrator',
  'College Administrator',
  'Staff',
  'Employee',
  'Manager',
  'HR',
  'IT Staff',
  'Organization Administrator',
  'Other',
];

export const USER_ROLE_CATEGORIES = {
  academic: [
    'Student',
    'Research Scholar',
    'Teaching Assistant',
    'Professor',
    'Lecturer',
    'Teacher',
    'Staff',
    'HOD',
    'Principal',
  ],
  corporate: [
    'Employee',
    'Manager',
    'HR',
    'IT Staff',
    'Team Lead',
    'Other',
  ],
};

export const DEGREE_TYPES = [
  'B.E.',
  'B.Tech',
  'B.Sc.',
  'BCA',
  'M.E.',
  'M.Tech',
  'MBA',
  'Other',
];

export const YEARS_OF_STUDY = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Final Year',
  'Other',
];

// ============================================================================
// 2. PROFILE FORMATTING & HELPERS
// ============================================================================

/**
 * Returns a compact, public-safe profile summary string (e.g. "Student • 2nd Year • CSE").
 * NEVER outputs private identifiers such as Roll Number, Student ID, or Contact Number.
 */
export const formatCompactProfile = (profile) => {
  if (!profile) return '';
  const role = profile.professionalRole;
  if (!role) return '';

  if (role === 'Student') {
    const parts = ['Student'];
    if (profile.currentYearOfStudy) parts.push(profile.currentYearOfStudy);
    if (profile.department) parts.push(profile.department);
    else if (profile.degreeType) parts.push(profile.degreeType);
    return parts.join(' • ');
  }

  if (role === 'Research Scholar') {
    const parts = ['Research Scholar'];
    if (profile.department) parts.push(profile.department);
    else if (profile.researchProgram) parts.push(profile.researchProgram);
    return parts.join(' • ');
  }

  if (['Professor', 'Lecturer', 'Teacher', 'HOD', 'Principal', 'Teaching Assistant'].includes(role)) {
    const parts = [role];
    if (profile.department) parts.push(profile.department);
    return parts.join(' • ');
  }

  if (['Employee', 'Manager', 'Team Lead', 'HR', 'IT Staff'].includes(role)) {
    const parts = [role];
    if (profile.department) parts.push(profile.department);
    else if (profile.designation) parts.push(profile.designation);
    return parts.join(' • ');
  }

  // Other or custom role
  const title = profile.customRole?.trim() || role;
  const parts = [title];
  if (profile.department) parts.push(profile.department);
  else if (profile.designation) parts.push(profile.designation);
  return parts.join(' • ');
};

/**
 * Resolves the effective profile for a user given an active workspace context.
 * Workspace-specific attributes override global attributes without mutating the global state.
 */
export const getEffectiveProfile = (userProfile, workspaceId) => {
  if (!userProfile) return null;
  if (workspaceId && userProfile.workspaceProfiles?.[workspaceId]) {
    return {
      ...userProfile,
      ...userProfile.workspaceProfiles[workspaceId],
      isWorkspaceSpecific: true,
      activeWorkspaceId: workspaceId,
    };
  }
  return {
    ...userProfile,
    isWorkspaceSpecific: false,
  };
};

/**
 * Determines whether the user has completed their profile based on required fields.
 */
export const isProfileComplete = (profile) => {
  if (!profile) return false;
  const hasName = Boolean(profile.fullName && profile.fullName.trim());
  const role = profile.professionalRole;

  if (!hasName || !role) return false;

  if (role === 'Student') {
    return Boolean(
      profile.organization?.trim() &&
      profile.department?.trim() &&
      profile.degreeType &&
      profile.currentYearOfStudy
    );
  }

  if (role === 'Other') {
    return Boolean(
      profile.customRole?.trim() &&
      profile.organization?.trim()
    );
  }

  // For other professional/academic roles
  return Boolean(
    profile.organization?.trim() &&
    profile.department?.trim()
  );
};

/**
 * Generates an appropriate, non-intrusive banner prompt message when a profile is incomplete.
 */
export const getProfileCompletionPrompt = (profile, isAdmin) => {
  if (isProfileComplete(profile)) return null;
  const role = profile?.professionalRole;
  if (isAdmin) {
    return 'Complete your professional profile to personalize your workspace.';
  }
  if (role === 'Student') {
    return 'Complete your academic profile to personalize your workspace.';
  }
  return 'Complete your professional profile to personalize your workspace.';
};

// ============================================================================
// 3. PHOTO PROCESSING
// ============================================================================

/**
 * Processes and compresses a profile photo using browser canvas.
 * Produces a lightweight, crisp Data URL payload (max 500x500, quality 0.82)
 * that persists instantaneously without requiring external storage bucket provisioning.
 */
export const processProfilePhoto = async (file) => {
  if (!file) return null;
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const compressed = await fileToCompressedDataUrl(file, 500, 0.82);
  return compressed;
};

// ============================================================================
// 4. PERSISTENCE & FIRESTORE SAVE
// ============================================================================

/**
 * Saves profile data to Firestore.
 * Supports:
 * - Global account profile update (`users/{userId}`)
 * - Workspace-scoped profile update (`users/{userId}.workspaceProfiles[workspaceId]`)
 * - Sync to `workspaceMembers/{userId}_{workspaceId}` if workspaceId is specified
 *
 * GUARANTEES:
 * - Permission role ('admin' / 'user') is never modified or escalated.
 * - UID and Email are never modified.
 * - Errors are propagated to the caller for clear feedback.
 */
export const saveProfileToFirestore = async ({
  userId,
  profileData,
  workspaceId = null,
  asDefault = true,
}) => {
  if (!userId) {
    throw new Error('User authentication identity is missing.');
  }
  if (!db) {
    throw new Error('Database service is not configured.');
  }

  // Whitelist of valid professional/academic profile fields
  const allowedFields = [
    'fullName',
    'avatarUrl',
    'avatarPreference',
    'contactNumber',
    'country',
    'shortBio',
    'professionalRole',
    'customRole',
    'organization',
    'department',
    'designation',
    'yearsOfExperience',
    'departmentManaged',
    'institutionType',
    'technicalDesignation',
    'specialization',
    'course',
    'degreeType',
    'academicYear',
    'currentYearOfStudy',
    'section',
    'rollNumber',
    'researchProgram',
    'researchArea',
    'supervisor',
    'team',
    'employeeId',
  ];

  // Clean and sanitize input fields
  const cleanPayload = {};
  for (const key of allowedFields) {
    if (profileData[key] !== undefined) {
      cleanPayload[key] = profileData[key] === null ? null : String(profileData[key]).trim();
    }
  }

  // Ensure full name is never blank
  if (cleanPayload.fullName !== undefined && !cleanPayload.fullName) {
    throw new Error('Full Name cannot be blank.');
  }

  // Ensure role is present
  if (cleanPayload.professionalRole !== undefined && !cleanPayload.professionalRole) {
    throw new Error('Please select a professional or academic role.');
  }

  if (cleanPayload.professionalRole === 'Other' && !cleanPayload.customRole) {
    throw new Error('Please specify your custom role title.');
  }

  const userRef = doc(db, 'users', userId);
  const now = serverTimestamp();

  // 1. Read existing profile doc to preserve existing nested workspaceProfiles
  let existingData = {};
  try {
    const snap = await withTimeout(getDoc(userRef), 4000);
    if (snap.exists()) {
      existingData = snap.data();
    }
  } catch (readErr) {
    console.warn('[UNSAID Profile Service] Notice during existing profile read:', readErr.message);
  }

  const updatesForUsersDoc = {
    updatedAt: now,
  };

  // If saving as global default or if no specific workspace selected
  if (asDefault || !workspaceId) {
    Object.assign(updatesForUsersDoc, cleanPayload);
  }

  // If a workspaceId is provided, also nest this profile under workspaceProfiles[workspaceId]
  if (workspaceId) {
    const existingWsProfiles = existingData.workspaceProfiles || {};
    updatesForUsersDoc.workspaceProfiles = {
      ...existingWsProfiles,
      [workspaceId]: {
        ...(existingWsProfiles[workspaceId] || {}),
        ...cleanPayload,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  // Write to users collection
  await withTimeout(setDoc(userRef, updatesForUsersDoc, { merge: true }), 6000);

  // 2. Also sync to workspaceMembers if workspaceId is present
  if (workspaceId) {
    try {
      const memberDocId = `${userId}_${workspaceId}`;
      const memberRef = doc(db, 'workspaceMembers', memberDocId);
      const memberSnap = await withTimeout(getDoc(memberRef), 3000);

      if (memberSnap.exists()) {
        const memberUpdates = {
          updatedAt: now,
          userName: cleanPayload.fullName || existingData.fullName || 'Member',
          professionalRole: cleanPayload.professionalRole || '',
          department: cleanPayload.department || '',
          designation: cleanPayload.designation || cleanPayload.technicalDesignation || '',
          organization: cleanPayload.organization || '',
          profile: {
            ...cleanPayload,
            updatedAt: new Date().toISOString(),
          },
        };
        if (cleanPayload.avatarUrl) {
          memberUpdates.avatarUrl = cleanPayload.avatarUrl;
        }

        await withTimeout(setDoc(memberRef, memberUpdates, { merge: true }), 4000);
      }
    } catch (memErr) {
      console.warn('[UNSAID Profile Service] Sync to workspaceMembers notice:', memErr.message);
      // Non-fatal if workspaceMembers is pending backend rules
    }
  }

  // Construct updated merged profile representation for local state update
  const mergedProfile = {
    ...existingData,
    ...updatesForUsersDoc,
    // Preserve core permission role & identity fields
    uid: userId,
    email: existingData.email,
    role: existingData.role,
  };

  // Save to persistent localStorage cache
  try {
    localStorage.setItem(`unsaid_profile_${userId}`, JSON.stringify(mergedProfile));
  } catch {}

  return mergedProfile;
};
