import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Service for managing user notifications in Firestore.
 * Canonical collection: 'notifications'
 */

/**
 * Creates and dispatches a notification to a specific user.
 */
export const createNotification = async ({
  userId,
  type = 'general',
  title = 'Notification',
  message = '',
  problemId = null,
  workspaceId = null,
  workspaceName = null,
  resolutionCycleId = null,
  metadata = {},
}) => {
  if (!userId) return null;

  const notifData = {
    userId,
    type,
    title,
    message,
    problemId: problemId || null,
    workspaceId: workspaceId || null,
    workspaceName: workspaceName || null,
    resolutionCycleId: resolutionCycleId || null,
    metadata: metadata || {},
    read: false,
    createdAt: serverTimestamp(),
  };

  // Local storage cache for offline resilience and instant UI availability
  try {
    const localKey = `unsaid_notifs_${userId}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const tempId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const localItem = {
      ...notifData,
      id: tempId,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(localKey, JSON.stringify([localItem, ...existing.slice(0, 49)]));
  } catch {
    // Non-blocking
  }

  if (!db) return null;

  try {
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, notifData);
    return { id: notifRef.id, ...notifData };
  } catch (err) {
    console.warn('[UNSAID Notification Dispatch Warning]', err.message);
    return null;
  }
};

/**
 * Dispatches a notification to all administrators of a workspace.
 */
export const notifyWorkspaceAdmins = async ({
  workspaceId,
  type = 'admin_alert',
  title = 'Workspace Alert',
  message = '',
  problemId = null,
  excludeUserId = null,
  metadata = {},
}) => {
  if (!workspaceId) return [];
  const adminIds = new Set();

  try {
    if (db) {
      const wsRef = doc(db, 'workspaces', workspaceId);
      const wsSnap = await getDoc(wsRef);
      if (wsSnap.exists()) {
        const wsData = wsSnap.data();
        if (wsData.createdBy) adminIds.add(wsData.createdBy);
        const wsName = wsData.name || 'Workspace';

        try {
          const membersRef = collection(db, 'workspaceMembers');
          const q = query(
            membersRef,
            where('workspaceId', '==', workspaceId),
            where('role', '==', 'admin')
          );
          const membersSnap = await getDocs(q);
          membersSnap.forEach((m) => {
            const mData = m.data();
            if (mData.userId) adminIds.add(mData.userId);
          });
        } catch {
          // Fallback to creator
        }

        const dispatches = [];
        for (const adminId of adminIds) {
          if (adminId && adminId !== excludeUserId) {
            dispatches.push(
              createNotification({
                userId: adminId,
                type,
                title,
                message,
                problemId,
                workspaceId,
                workspaceName: wsName,
                metadata,
              })
            );
          }
        }
        return await Promise.all(dispatches);
      }
    }
  } catch (err) {
    console.warn('[UNSAID Notify Admins Warning]', err.message);
  }
  return [];
};

/**
 * Dispatches a notification to all eligible reporters of a problem.
 */
export const notifyEligibleReporters = async ({
  problemId,
  workspaceId,
  reporterIds = [],
  type = 'problem_update',
  title = 'Query Update',
  message = '',
  excludeUserId = null,
  metadata = {},
}) => {
  if (!Array.isArray(reporterIds) || reporterIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(reporterIds));
  const dispatches = [];
  for (const reporterId of uniqueIds) {
    if (reporterId && reporterId !== excludeUserId) {
      dispatches.push(
        createNotification({
          userId: reporterId,
          type,
          title,
          message,
          problemId,
          workspaceId,
          metadata,
        })
      );
    }
  }
  return await Promise.all(dispatches);
};

/**
 * Subscribes to real-time notifications for a specific user.
 *
 * @param {string} userId - The target user's UID.
 * @param {function} onNext - Callback receiving array of notifications.
 * @param {function} onError - Optional error callback.
 * @returns {function} Unsubscribe function.
 */
export const subscribeToUserNotifications = (userId, onNext, onError) => {
  if (!userId) {
    if (typeof onNext === 'function') onNext([]);
    return () => {};
  }

  // Load from local storage immediately for zero-delay UX
  try {
    const localKey = `unsaid_notifs_${userId}`;
    const cached = JSON.parse(localStorage.getItem(localKey) || '[]');
    if (cached.length > 0 && typeof onNext === 'function') {
      onNext(cached);
    }
  } catch {
    // Non-blocking
  }

  if (!db) {
    return () => {};
  }

  const notifRef = collection(db, 'notifications');
  const q = query(notifRef, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort newest first
      items.sort((a, b) => {
        const timeA =
          typeof a.createdAt?.toMillis === 'function'
            ? a.createdAt.toMillis()
            : a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : new Date(a.createdAt || 0).getTime();
        const timeB =
          typeof b.createdAt?.toMillis === 'function'
            ? b.createdAt.toMillis()
            : b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      // Cache locally
      try {
        localStorage.setItem(`unsaid_notifs_${userId}`, JSON.stringify(items.slice(0, 50)));
      } catch {
        // Non-blocking
      }

      if (typeof onNext === 'function') {
        onNext(items);
      }
    },
    (err) => {
      console.warn('[UNSAID Notifications Subscription Error]', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
};

/**
 * Marks a single notification as read.
 *
 * @param {string} notificationId - ID of notification document.
 */
export const markNotificationAsRead = async (notificationId) => {
  if (!db || !notificationId) return;
  try {
    const notifDocRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifDocRef, {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[UNSAID] Failed to mark notification as read:', err);
  }
};

/**
 * Marks all unread notifications for a user as read using a batch write.
 *
 * @param {Array} notifications - Array of notification objects.
 */
export const markAllNotificationsAsRead = async (notifications = []) => {
  if (!db || !Array.isArray(notifications)) return;

  const unreadItems = notifications.filter((n) => !n.read && n.id);
  if (unreadItems.length === 0) return;

  try {
    const batch = writeBatch(db);
    unreadItems.forEach((item) => {
      const ref = doc(db, 'notifications', item.id);
      batch.update(ref, {
        read: true,
        readAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (err) {
    console.error('[UNSAID] Failed to mark all notifications as read:', err);
  }
};

/**
 * Deletes a notification document.
 *
 * @param {string} notificationId - ID of notification document.
 */
export const deleteNotification = async (notificationId) => {
  if (!db || !notificationId) return;
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (err) {
    console.error('[UNSAID] Failed to delete notification:', err);
  }
};
