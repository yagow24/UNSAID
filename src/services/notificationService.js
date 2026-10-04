import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Service for managing user notifications in Firestore.
 * Canonical collection: 'notifications'
 */

/**
 * Subscribes to real-time notifications for a specific user.
 *
 * @param {string} userId - The target user's UID.
 * @param {function} onNext - Callback receiving array of notifications.
 * @param {function} onError - Optional error callback.
 * @returns {function} Unsubscribe function.
 */
export const subscribeToUserNotifications = (userId, onNext, onError) => {
  if (!db || !userId) {
    if (typeof onNext === 'function') onNext([]);
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
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

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
