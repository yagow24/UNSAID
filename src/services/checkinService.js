/**
 * Daily Check-in & Pulse Service
 * 
 * Manages daily pulse check-ins for workspace members.
 * Supports configurable questions and option sets.
 * Enforces one submission per user per day per workspace using deterministic dateKey (YYYY-MM-DD).
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { enqueueOfflinePulse } from './offlineSyncService';

export const DEFAULT_CHECKIN_CONFIG = {
  question: 'How are things going in your workspace today?',
  options: [
    { id: 'super', label: 'Super', emoji: '😍', value: 4, variant: 'cyan' },
    { id: 'good', label: 'Good', emoji: '🙂', value: 3, variant: 'primary' },
    { id: 'average', label: 'Average', emoji: '😐', value: 2, variant: 'warning' },
    { id: 'bad', label: 'Bad', emoji: '🙁', value: 1, variant: 'danger' },
  ],
};

export const getTodayDateKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// In-memory / session fallback store for instant UI reactivity
const sessionCheckinStore = new Map();

/**
 * Retrieves today's check-in for the current user in the active workspace.
 */
export const getUserTodayCheckin = async (workspaceId, userId) => {
  if (!workspaceId || !userId) return null;
  const todayDate = getTodayDateKey();
  const checkinDocId = `${userId}_${workspaceId}_${todayDate}`;

  if (sessionCheckinStore.has(checkinDocId)) {
    return sessionCheckinStore.get(checkinDocId);
  }

  // 1. Direct document retrieval by deterministic document ID (O(1) read, no composite index needed)
  if (db) {
    try {
      const docRef = doc(db, 'checkins', checkinDocId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        sessionCheckinStore.set(checkinDocId, data);
        return data;
      }
    } catch (err) {
      console.warn('[UNSAID Check-in] Read checkin document note:', err.message);
    }
  }

  // 2. Check local fallback
  try {
    const raw = localStorage.getItem(`unsaid_checkin_${checkinDocId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      sessionCheckinStore.set(checkinDocId, parsed);
      return parsed;
    }
  } catch {}

  return null;
};

/**
 * Submits a daily check-in response.
 * Enforces one response per user per workspace per calendar day.
 */
export const submitDailyCheckin = async ({
  workspaceId,
  userId,
  userEmail,
  userName,
  selectedOptionId,
  question = DEFAULT_CHECKIN_CONFIG.question,
  anonymous = false,
}) => {
  if (!workspaceId || !userId || !selectedOptionId) {
    throw new Error('Workspace, user, and selection are required.');
  }

  const todayDate = getTodayDateKey();
  const checkinDocId = `${userId}_${workspaceId}_${todayDate}`;

  // Prevent duplicate submissions
  const existing = await getUserTodayCheckin(workspaceId, userId);
  if (existing) {
    return { alreadySubmitted: true, checkin: existing };
  }

  const option =
    DEFAULT_CHECKIN_CONFIG.options.find((o) => o.id === selectedOptionId) ||
    DEFAULT_CHECKIN_CONFIG.options[1];

  const checkinRecord = {
    id: checkinDocId,
    workspaceId,
    userId,
    rating: option.value,
    dateKey: todayDate,
    anonymous: Boolean(anonymous),
    question,
    selectedOptionId: option.id,
    selectedLabel: option.label,
    selectedEmoji: option.emoji,
    userName: anonymous ? 'Anon Member' : (userName || 'Member'),
    userEmail: anonymous ? '' : (userEmail || ''),
    createdAt: new Date().toISOString(),
  };

  // Cache in session
  sessionCheckinStore.set(checkinDocId, checkinRecord);
  try {
    localStorage.setItem(`unsaid_checkin_${checkinDocId}`, JSON.stringify(checkinRecord));
  } catch {}

  // If offline, enqueue pulse to local queue
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflinePulse({
      ...checkinRecord,
      docId: checkinDocId,
    });
    return { alreadySubmitted: false, checkin: { ...checkinRecord, isOfflineQueued: true } };
  }

  // Write to Firestore checkins collection
  if (db) {
    try {
      const docRef = doc(db, 'checkins', checkinDocId);
      await setDoc(
        docRef,
        {
          ...checkinRecord,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (firestoreErr) {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || firestoreErr.code === 'unavailable') {
        enqueueOfflinePulse({
          ...checkinRecord,
          docId: checkinDocId,
        });
      }
      console.warn('[UNSAID Check-in] Stored locally (Firestore write note):', firestoreErr.message);
    }
  }

  return { alreadySubmitted: false, checkin: checkinRecord };
};
