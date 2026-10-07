/**
 * Problem Service & Data Contract
 * 
 * Manages workspace-scoped problem reporting, query feeds, and voting.
 * Compatible with future Part 5 Flask + Firebase Admin backend authorization.
 * Adheres strictly to security rules without inventing weak client rules.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { enqueueOfflineProblem, enqueueOfflineMessage } from './offlineSyncService';

const withTimeout = (promise, ms = 4500) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error('Database operation timed out');
        err.code = 'unavailable';
        reject(err);
      }, ms);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);

const LOCAL_STORAGE_PROBLEMS_PREFIX = 'unsaid_ws_problems_';

const getLocalProblems = (workspaceId) => {
  if (!workspaceId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalProblem = (workspaceId, problem) => {
  if (!workspaceId) return;
  try {
    const existing = getLocalProblems(workspaceId);
    const updated = [problem, ...existing.filter((p) => p.id !== problem.id)];
    localStorage.setItem(
      `${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`,
      JSON.stringify(updated.slice(0, 100))
    );
  } catch (err) {
    console.warn('[UNSAID Problem Service] Local cache write failed:', err);
  }
};

const sortProblems = (list) => {
  return [...list].sort((a, b) => {
    // 1. Emergency queries strictly first
    if (Boolean(a.isEmergency) !== Boolean(b.isEmergency)) {
      return a.isEmergency ? -1 : 1;
    }
    // 2. Open queries prioritized before Solved queries
    const isSolvedA = a.status === 'solved';
    const isSolvedB = b.status === 'solved';
    if (isSolvedA !== isSolvedB) {
      return isSolvedA ? 1 : -1;
    }
    // 3. Most recent queries first
    const timeA =
      a.createdAt?.toMillis?.() ||
      (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) ||
      (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB =
      b.createdAt?.toMillis?.() ||
      (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) ||
      (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });
};

/**
 * Submits a new problem scoped strictly to a workspace.
 */
export const submitProblem = async ({
  workspaceId,
  title,
  description,
  category = 'General',
  subIssue = '',
  isEmergency = false,
  isConfidential = false,
  workaround = '',
  shiftStatus = 'ACTIVE SHIFT',
  currentUser = null,
  userProfile = null,
  isAnonymous = false,
  pseudonym = null,
  imageUrl = null,
  imagePath = null,
  aiAnalysis = null,
}) => {
  if (!workspaceId) {
    throw new Error('Workspace identifier is required to submit a problem.');
  }
  if (!title || !title.trim()) {
    throw new Error('Please enter a descriptive problem title.');
  }
  if (!description || !description.trim()) {
    throw new Error('Please provide details for the problem description.');
  }

  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  const trimmedCategory = (category || 'General').trim();
  const trimmedSubIssue = (subIssue || '').trim();
  const trimmedWorkaround = (workaround || '').trim();

  const authorId = currentUser?.uid || 'anon_user';
  const authorName = isAnonymous
    ? (pseudonym || 'Anon Member')
    : (userProfile?.fullName || currentUser?.displayName || 'Workspace Member');
  const authorEmail = isAnonymous ? '' : (currentUser?.email || '');

  const problemData = {
    workspaceId,
    title: trimmedTitle,
    description: trimmedDesc,
    category: trimmedCategory,
    subIssue: trimmedSubIssue || null,
    isEmergency: Boolean(isEmergency),
    isConfidential: Boolean(isConfidential),
    readByAdmin: false,
    readByUser: true,
    priority: isEmergency ? 'emergency' : 'normal',
    workaround: trimmedWorkaround,
    shiftStatus: shiftStatus || 'ACTIVE SHIFT',
    status: 'open', // 'open' | 'solved'
    createdBy: authorId,
    authorId,
    authorName,
    authorEmail,
    isAnonymous: Boolean(isAnonymous),
    imageUrl: imageUrl || null,
    imagePath: imagePath || null,
    aiAnalysis: aiAnalysis || null,
    upvotesCount: 0,
    upvotedBy: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Client-ready representation with deterministic temporary ID
  const localId = `prob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const clientProblem = {
    ...problemData,
    id: localId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // If offline, enqueue directly to local offline queue and return client-ready object
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineProblem(problemData);
    saveLocalProblem(workspaceId, { ...clientProblem, isOfflineQueued: true });
    return { ...clientProblem, isOfflineQueued: true };
  }

  if (db) {
    try {
      const probRef = collection(db, 'problems');
      const docRef = await withTimeout(addDoc(probRef, problemData), 4500);
      clientProblem.id = docRef.id;

      // Automatically notify the workspace administrator
      try {
        const wsRef = doc(db, 'workspaces', workspaceId);
        const wsSnap = await withTimeout(getDoc(wsRef), 3000);
        if (wsSnap.exists()) {
          const wsData = wsSnap.data();
          const adminUid = wsData.createdBy;
          if (adminUid && adminUid !== authorId) {
            const notifRef = doc(collection(db, 'notifications'));
            await setDoc(notifRef, {
              userId: adminUid,
              type: isEmergency ? 'emergency_problem' : 'problem_reported',
              title: isEmergency ? '🚨 Emergency Query Reported' : 'New Query Reported',
              message: `${authorName} reported "${trimmedTitle}" in "${wsData.name || 'Workspace'}".`,
              problemId: docRef.id,
              workspaceId,
              workspaceName: wsData.name || 'Workspace',
              read: false,
              createdAt: serverTimestamp(),
            });
          }
        }
      } catch (notifErr) {
        console.warn('[UNSAID Problem Service] Admin notification dispatch notice:', notifErr.message);
      }
    } catch (firestoreErr) {
      if (
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        firestoreErr.code === 'unavailable' ||
        firestoreErr.code === 'deadline-exceeded'
      ) {
        enqueueOfflineProblem(problemData);
        saveLocalProblem(workspaceId, { ...clientProblem, isOfflineQueued: true });
        return { ...clientProblem, isOfflineQueued: true };
      }
      console.error('[UNSAID Problem Service] Firestore write failed:', firestoreErr);
      throw firestoreErr;
    }
  }

  saveLocalProblem(workspaceId, clientProblem);
  return clientProblem;
};

/**
 * Fetches problems scoped strictly to the given workspace.
 * Orders emergency problems first, followed by newest timestamp.
 */
export const getWorkspaceProblems = async (workspaceId) => {
  if (!workspaceId) return [];

  let firestoreList = [];

  if (db) {
    try {
      const probRef = collection(db, 'problems');
      const q = query(probRef, where('workspaceId', '==', workspaceId));
      const snap = await getDocs(q);
      firestoreList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      // Fall through to local cache if Firestore is pending backend rules
    }
  }

  const localList = getLocalProblems(workspaceId);

  // Merge unique by ID
  const seenIds = new Set();
  const merged = [];

  for (const item of [...firestoreList, ...localList]) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      merged.push(item);
    }
  }

  return sortProblems(merged);
};

/**
 * Real-time listener for workspace problems.
 * Scoped strictly to workspaceId using Firestore onSnapshot.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeToWorkspaceProblems = (workspaceId, onUpdate, onError) => {
  if (!workspaceId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  // Fast initial load from local cache if available
  const localList = getLocalProblems(workspaceId);
  if (localList.length > 0 && onUpdate) {
    onUpdate(sortProblems(localList));
  }

  if (!db) {
    if (onUpdate) onUpdate(sortProblems(localList));
    return () => {};
  }

  try {
    const probRef = collection(db, 'problems');
    const q = query(probRef, where('workspaceId', '==', workspaceId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const currentLocal = getLocalProblems(workspaceId);
        const seenIds = new Set();
        const merged = [];

        for (const item of [...firestoreList, ...currentLocal]) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            merged.push(item);
          }
        }

        if (onUpdate) {
          onUpdate(sortProblems(merged));
        }
      },
      (error) => {
        console.error('[UNSAID Problem Service Snapshot Error]', error);
        if (onError) onError(error);
        const currentLocal = getLocalProblems(workspaceId);
        if (onUpdate) onUpdate(sortProblems(currentLocal));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('[UNSAID Problem Service Subscribe Error]', err);
    if (onError) onError(err);
    const currentLocal = getLocalProblems(workspaceId);
    if (onUpdate) onUpdate(sortProblems(currentLocal));
    return () => {};
  }
};

/**
 * Updates the status of a problem (e.g. 'solved' or 'open').
 */
export const updateProblemStatus = async (problemId, status, workspaceId) => {
  if (!problemId) return;

  if (db) {
    try {
      const probRef = doc(db, 'problems', problemId);
      await updateDoc(probRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[UNSAID Problem Service] Firestore status update error:', err);
    }
  }

  if (workspaceId) {
    const local = getLocalProblems(workspaceId);
    const updated = local.map((p) => (p.id === problemId ? { ...p, status } : p));
    localStorage.setItem(
      `${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`,
      JSON.stringify(updated)
    );
  }
};

/**
 * Toggles an upvote on a problem.
 */
export const toggleProblemUpvote = async (problemId, userId, workspaceId) => {
  if (!problemId || !userId || !workspaceId) return null;

  const localList = getLocalProblems(workspaceId);
  const target = localList.find((p) => p.id === problemId);

  if (target) {
    const hasUpvoted = target.upvotedBy?.includes(userId);
    const updatedUpvotedBy = hasUpvoted
      ? (target.upvotedBy || []).filter((id) => id !== userId)
      : [...(target.upvotedBy || []), userId];
    const updatedCount = Math.max(0, updatedUpvotedBy.length);

    target.upvotedBy = updatedUpvotedBy;
    target.upvotesCount = updatedCount;
    saveLocalProblem(workspaceId, target);

    if (db) {
      try {
        const probDocRef = doc(db, 'problems', problemId);
        await updateDoc(probDocRef, {
          upvotesCount: increment(hasUpvoted ? -1 : 1),
          upvotedBy: hasUpvoted ? arrayRemove(userId) : arrayUnion(userId),
        });
      } catch {}
    }

    return { upvotesCount: updatedCount, hasUpvoted: !hasUpvoted };
  }

  return null;
};

// =====================================================================
// PART 3B-2: TWO-WAY MESSAGING, RESOLUTIONS, ACKNOWLEDGEMENTS, ESCALATION
// =====================================================================

const LOCAL_STORAGE_MESSAGES_PREFIX = 'unsaid_prob_messages_';
const LOCAL_STORAGE_ACKS_PREFIX = 'unsaid_prob_acks_';
const LOCAL_STORAGE_VOTES_PREFIX = 'unsaid_prob_votes_';
const LOCAL_STORAGE_FEEDBACK_PREFIX = 'unsaid_prob_feedback_';

const getLocalItems = (prefix, problemId) => {
  if (!problemId) return [];
  try {
    const raw = localStorage.getItem(`${prefix}${problemId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalItems = (prefix, problemId, items) => {
  if (!problemId) return;
  try {
    localStorage.setItem(`${prefix}${problemId}`, JSON.stringify(items));
  } catch {}
};

/**
 * 1. TWO-WAY MESSAGING: Subscribes to problemMessages in real time.
 */
export const subscribeToProblemMessages = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
  if (local.length > 0 && onUpdate) {
    onUpdate(local);
  }

  if (!db) {
    return () => {};
  }

  try {
    const messagesRef = collection(db, 'problemMessages');
    const q = query(
      messagesRef,
      where('problemId', '==', problemId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreMessages = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            // Ensure compatibility mappings between spec fields and UI props
            authorId: data.senderId,
            authorName: data.senderName,
            authorRole: data.senderRole,
            text: data.message,
            isStaffResponse: Boolean(data.isOfficial),
          };
        });

        // Merge unique by ID with local cache
        const seen = new Set();
        const merged = [];
        for (const m of [...firestoreMessages, ...getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId)]) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            merged.push(m);
          }
        }

        merged.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeA - timeB;
        });

        saveLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId, merged);
        if (onUpdate) onUpdate(merged);
      },
      (err) => {
        console.warn('[UNSAID Messages Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Problem Messages Error]', err);
    return () => {};
  }
};

/**
 * Sends a real message to problemMessages collection.
 */
export const sendProblemMessage = async ({
  problemId,
  workspaceId,
  message,
  text,
  currentUser,
  userProfile,
  isAnonymous = false,
  pseudonym = null,
  isOfficial = false,
  isStaff = false,
}) => {
  const content = (message || text || '').trim();
  if (!problemId || !workspaceId || !content) {
    throw new Error('Problem context, workspace, and message content are required.');
  }

  const senderId = currentUser?.uid || 'anon_user';
  const senderName = isAnonymous
    ? (pseudonym || 'Anon Member')
    : (userProfile?.fullName || currentUser?.displayName || (isOfficial || isStaff ? 'Staff Support' : 'Workspace Member'));
  const senderEmail = isAnonymous ? '' : (currentUser?.email || '');
  const senderRole = (isOfficial || isStaff) ? 'admin' : (userProfile?.role || 'member');
  const officialFlag = Boolean(isOfficial || isStaff);

  const messageDoc = {
    problemId,
    workspaceId,
    senderId,
    senderName,
    senderEmail,
    senderRole,
    message: content,
    isOfficial: officialFlag,
    isDismissed: false,
    dismissedBy: null,
    dismissedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const localId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const clientMessage = {
    ...messageDoc,
    id: localId,
    authorId: senderId,
    authorName: senderName,
    authorRole: senderRole,
    text: content,
    isStaffResponse: officialFlag,
    createdAt: new Date().toISOString(),
  };

  const currentLocal = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
  saveLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId, [...currentLocal, clientMessage]);

  // If offline, enqueue message to local offline queue and display in local thread
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueOfflineMessage(messageDoc);
    return { ...clientMessage, isOfflineQueued: true };
  }

  if (db) {
    try {
      const messagesRef = collection(db, 'problemMessages');
      const docRef = await addDoc(messagesRef, messageDoc);
      clientMessage.id = docRef.id;
      const updatedLocal = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
      saveLocalItems(
        LOCAL_STORAGE_MESSAGES_PREFIX,
        problemId,
        updatedLocal.map((m) => (m.id === localId ? clientMessage : m))
      );
    } catch (err) {
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || err.code === 'unavailable') {
        enqueueOfflineMessage(messageDoc);
        return { ...clientMessage, isOfflineQueued: true };
      }
      console.error('[UNSAID Send Message Error]', err);
      throw err;
    }
  }

  return clientMessage;
};

/**
 * Marks a problem thread as read by user or admin.
 */
export const markProblemThreadRead = async (problemId, role = 'member') => {
  if (!problemId || !db) return;
  try {
    const probRef = doc(db, 'problems', problemId);
    await updateDoc(probRef, role === 'admin' ? { readByAdmin: true } : { readByUser: true });
  } catch {
    // Non-blocking for unauthenticated or offline views
  }
};

/**
 * Dismisses an unhelpful comment (authorized to author/admin).
 */
export const dismissProblemMessage = async ({
  messageId,
  dismissedByUserId,
  problemId,
}) => {
  if (!messageId) return;

  if (problemId) {
    const local = getLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId);
    const updated = local.map((m) =>
      m.id === messageId ? { ...m, isDismissed: true, dismissedBy: dismissedByUserId } : m
    );
    saveLocalItems(LOCAL_STORAGE_MESSAGES_PREFIX, problemId, updated);
  }

  if (db) {
    try {
      const msgRef = doc(db, 'problemMessages', messageId);
      await updateDoc(msgRef, {
        isDismissed: true,
        dismissedBy: dismissedByUserId,
        dismissedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[UNSAID Dismiss Message Error]', err);
    }
  }
};

/**
 * 2. OFFICIAL RESOLUTION BROADCAST: Admin marks official resolution on problem doc.
 */
export const broadcastOfficialResolution = async ({
  problemId,
  workspaceId,
  resolutionText,
  summary,
  actionTaken = '',
  adminUser,
  adminProfile,
}) => {
  const text = (resolutionText || summary || '').trim();
  if (!problemId || !text) {
    throw new Error('Resolution explanation is required.');
  }

  const resolverName = adminProfile?.fullName || adminUser?.displayName || 'Workspace Admin';
  const resolverId = adminUser?.uid || 'admin';

  const officialResolution = {
    resolutionText: text,
    summary: text,
    actionTaken: (actionTaken || '').trim(),
    resolvedBy: resolverId,
    resolvedByName: resolverName,
    resolvedAt: new Date().toISOString(),
    workspaceId: workspaceId || '',
    problemId,
  };

  if (workspaceId) {
    const local = getLocalProblems(workspaceId);
    const updated = local.map((p) =>
      p.id === problemId
        ? {
            ...p,
            status: 'solved',
            officialResolution,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    saveLocalProblems(workspaceId, updated);
  }

  if (db) {
    const probRef = doc(db, 'problems', problemId);
    await updateDoc(probRef, {
      status: 'solved',
      officialResolution,
      updatedAt: serverTimestamp(),
    });
  }

  return officialResolution;
};

/**
 * Helper to update local problem collection cache.
 */
const saveLocalProblems = (workspaceId, list) => {
  if (!workspaceId) return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`, JSON.stringify(list));
  } catch {}
};

/**
 * 3. DYNAMIC ACKNOWLEDGEMENT: Real Firestore acknowledgements collection.
 * Deterministic doc ID: {problemId}_{userId}.
 */
export const subscribeToProblemAcknowledgements = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const acksRef = collection(db, 'acknowledgements');
    const q = query(acksRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreAcks = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId, firestoreAcks);
        if (onUpdate) onUpdate(firestoreAcks);
      },
      (err) => {
        console.warn('[UNSAID Acks Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Acks Error]', err);
    return () => {};
  }
};

export const toggleProblemAcknowledgement = async ({
  problemId,
  workspaceId,
  userId,
  eligibleMemberCount = 1,
  thresholdPercentage = 65,
}) => {
  if (!problemId || !userId || !workspaceId) return null;

  const docId = `${problemId}_${userId}`;
  const currentLocal = getLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId);
  const existsLocal = currentLocal.some((a) => a.userId === userId);

  let updatedLocal;
  let hasAcked;
  if (existsLocal) {
    updatedLocal = currentLocal.filter((a) => a.userId !== userId);
    hasAcked = false;
  } else {
    updatedLocal = [
      ...currentLocal,
      {
        id: docId,
        problemId,
        workspaceId,
        userId,
        response: 'acknowledged',
        createdAt: new Date().toISOString(),
      },
    ];
    hasAcked = true;
  }
  saveLocalItems(LOCAL_STORAGE_ACKS_PREFIX, problemId, updatedLocal);

  const ackCount = updatedLocal.length;
  const eligible = Math.max(1, eligibleMemberCount || 1);
  const percentage = Math.round((ackCount / eligible) * 100);
  const threshold = Number(thresholdPercentage) || 65;
  const isThresholdReached = percentage >= threshold;

  // Update local problem record
  const localProblems = getLocalProblems(workspaceId);
  const targetProblem = localProblems.find((p) => p.id === problemId);
  if (targetProblem) {
    targetProblem.acknowledgementsCount = ackCount;
    targetProblem.acknowledgementReached = isThresholdReached;
    targetProblem.isArchivedFromFeed = isThresholdReached;
    saveLocalProblems(workspaceId, localProblems);
  }

  if (db) {
    try {
      const ackDocRef = doc(db, 'acknowledgements', docId);
      if (hasAcked) {
        await setDoc(ackDocRef, {
          problemId,
          workspaceId,
          userId,
          response: 'acknowledged',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(ackDocRef);
      }

      // Check threshold and update problem document
      const probRef = doc(db, 'problems', problemId);
      const updatePayload = {
        acknowledgementsCount: ackCount,
        acknowledgementReached: isThresholdReached,
        isArchivedFromFeed: isThresholdReached,
        updatedAt: serverTimestamp(),
      };
      if (isThresholdReached) {
        updatePayload.archivedAt = serverTimestamp();
      }
      await updateDoc(probRef, updatePayload);
    } catch (err) {
      console.warn('[UNSAID Acknowledgement Write Error]', err);
    }
  }

  return {
    hasAcked,
    ackCount,
    percentage,
    isThresholdReached,
  };
};

/**
 * 4. COMMUNITY ESCALATION: Real Firestore escalationVotes collection.
 * Deterministic doc ID: {problemId}_{userId}.
 */
export const subscribeToEscalationVotes = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const votesRef = collection(db, 'escalationVotes');
    const q = query(votesRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreVotes = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId, firestoreVotes);
        if (onUpdate) onUpdate(firestoreVotes);
      },
      (err) => {
        console.warn('[UNSAID Escalation Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Escalation Error]', err);
    return () => {};
  }
};

export const submitEscalationVote = async ({
  problemId,
  workspaceId,
  userId,
  vote, // 'yes' | 'no'
}) => {
  if (!problemId || !userId || !workspaceId || !['yes', 'no'].includes(vote)) {
    return null;
  }

  const docId = `${problemId}_${userId}`;
  const currentLocal = getLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId);
  const existingVote = currentLocal.find((v) => v.userId === userId);

  let updatedLocal;
  let activeVote;

  if (existingVote && existingVote.vote === vote) {
    // Clicking same vote removes it
    updatedLocal = currentLocal.filter((v) => v.userId !== userId);
    activeVote = null;
  } else {
    // New or changed vote
    updatedLocal = [
      ...currentLocal.filter((v) => v.userId !== userId),
      {
        id: docId,
        problemId,
        workspaceId,
        userId,
        vote,
        createdAt: new Date().toISOString(),
      },
    ];
    activeVote = vote;
  }

  saveLocalItems(LOCAL_STORAGE_VOTES_PREFIX, problemId, updatedLocal);

  if (db) {
    try {
      const voteDocRef = doc(db, 'escalationVotes', docId);
      if (activeVote) {
        await setDoc(voteDocRef, {
          problemId,
          workspaceId,
          userId,
          vote: activeVote,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(voteDocRef);
      }
    } catch (err) {
      console.warn('[UNSAID Escalation Write Error]', err);
    }
  }

  return { activeVote, votes: updatedLocal };
};

/**
 * 5. QUALITY FEEDBACK: Real Firestore problemFeedback collection.
 * Deterministic doc ID: {problemId}_{userId}.
 */
export const subscribeToProblemFeedback = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate([]);
    return () => {};
  }

  const local = getLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId);
  if (local.length > 0 && onUpdate) onUpdate(local);

  if (!db) return () => {};

  try {
    const feedbackRef = collection(db, 'problemFeedback');
    const q = query(feedbackRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const firestoreFeedback = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        saveLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId, firestoreFeedback);
        if (onUpdate) onUpdate(firestoreFeedback);
      },
      (err) => {
        console.warn('[UNSAID Feedback Subscription Error]', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Subscribe Feedback Error]', err);
    return () => {};
  }
};

export const submitQualityFeedback = async ({
  problemId,
  workspaceId,
  userId,
  feedback, // 'solved' | 'partially_solved' | 'still_confused'
}) => {
  if (!problemId || !userId || !workspaceId || !['solved', 'partially_solved', 'still_confused'].includes(feedback)) {
    return null;
  }

  const docId = `${problemId}_${userId}`;
  const currentLocal = getLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId);
  const updatedLocal = [
    ...currentLocal.filter((f) => f.userId !== userId),
    {
      id: docId,
      problemId,
      workspaceId,
      userId,
      feedback,
      createdAt: new Date().toISOString(),
    },
  ];
  saveLocalItems(LOCAL_STORAGE_FEEDBACK_PREFIX, problemId, updatedLocal);

  if (db) {
    try {
      const feedbackDocRef = doc(db, 'problemFeedback', docId);
      await setDoc(feedbackDocRef, {
        problemId,
        workspaceId,
        userId,
        feedback,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[UNSAID Feedback Write Error]', err);
    }
  }

  return updatedLocal;
};

/**
 * 6. RECURRENCE TRACKING: Link recurring problem to previous incident.
 */
export const markProblemRecurring = async ({
  problemId,
  recurrenceOf,
  linkedProblemTitle,
  recurrenceCount = 2,
  workspaceId,
}) => {
  if (!problemId || !recurrenceOf || !workspaceId) {
    throw new Error('Problem context and recurrence target are required.');
  }

  const localList = getLocalProblems(workspaceId);
  const target = localList.find((p) => p.id === problemId);
  if (target) {
    target.isRecurring = true;
    target.recurrenceOf = recurrenceOf;
    target.linkedProblemId = recurrenceOf;
    target.linkedProblemTitle = linkedProblemTitle || 'Previous Incident';
    target.recurrenceCount = Number(recurrenceCount) || 2;
    saveLocalProblems(workspaceId, localList);
  }

  if (db) {
    const probRef = doc(db, 'problems', problemId);
    await updateDoc(probRef, {
      isRecurring: true,
      recurrenceOf,
      linkedProblemId: recurrenceOf,
      linkedProblemTitle: linkedProblemTitle || 'Previous Incident',
      recurrenceCount: Number(recurrenceCount) || 2,
      updatedAt: serverTimestamp(),
    });
  }

  return { isRecurring: true, recurrenceOf, linkedProblemTitle, recurrenceCount };
};

/**
 * Permanently deletes a problem/query.
 * Authorized for the author who reported the problem or workspace administrators.
 *
 * @param {string} problemId
 * @param {string} [workspaceId]
 * @returns {Promise<{ success: boolean }>}
 */
export const deleteProblem = async (problemId, workspaceId) => {
  if (!problemId) {
    throw new Error('Problem identifier is required to delete.');
  }

  // Remove from local storage cache if workspaceId is provided
  if (workspaceId) {
    try {
      const existing = getLocalProblems(workspaceId);
      const filtered = existing.filter((p) => p.id !== problemId);
      localStorage.setItem(
        `${LOCAL_STORAGE_PROBLEMS_PREFIX}${workspaceId}`,
        JSON.stringify(filtered)
      );
    } catch (err) {
      console.warn('[UNSAID Problem Service] Failed to remove from local cache:', err);
    }
  }

  if (db) {
    const probRef = doc(db, 'problems', problemId);
    await withTimeout(deleteDoc(probRef), 7000);
  }

  return { success: true };
};
