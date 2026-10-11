import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NotificationContext } from './notificationContextDef';
import {
  subscribeToUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/notificationService';

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const userId = currentUser?.uid;
  const seenNotificationIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);

  // Dismiss a specific toast
  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // Trigger an in-app visual toast banner
  const triggerToast = useCallback(
    ({ title, message, type = 'general', workspaceName, notifId, actionUrl }) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast = { id, title, message, type, workspaceName, notifId, actionUrl };

      setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep max 4 toasts at once

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        dismissToast(id);
      }, 6000);
    },
    [dismissToast]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!userId) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setNotifications([]);
          setLoading(false);
          seenNotificationIdsRef.current.clear();
          initialLoadDoneRef.current = false;
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setLoading(true);
      }
    });

    const unsubscribe = subscribeToUserNotifications(
      userId,
      (data) => {
        if (isCancelled) return;

        setNotifications(data);
        setLoading(false);

        // Detect newly arrived unread notifications and pop up toast
        if (initialLoadDoneRef.current) {
          data.forEach((item) => {
            if (!item.read && !seenNotificationIdsRef.current.has(item.id)) {
              triggerToast({
                title: item.title,
                message: item.message,
                type: item.type,
                workspaceName: item.workspaceName,
                notifId: item.id,
              });
            }
          });
        } else {
          // Check if any fresh notification arrived within the last 20 seconds
          const now = Date.now();
          data.forEach((item) => {
            if (!item.read) {
              const itemTime =
                typeof item.createdAt?.toMillis === 'function'
                  ? item.createdAt.toMillis()
                  : item.createdAt?.seconds
                  ? item.createdAt.seconds * 1000
                  : new Date(item.createdAt || 0).getTime();
              if (now - itemTime < 20000) {
                triggerToast({
                  title: item.title,
                  message: item.message,
                  type: item.type,
                  workspaceName: item.workspaceName,
                  notifId: item.id,
                });
              }
            }
          });
          initialLoadDoneRef.current = true;
        }

        // Record seen IDs
        data.forEach((item) => seenNotificationIdsRef.current.add(item.id));
      },
      (err) => {
        if (!isCancelled) {
          console.warn('[UNSAID NotificationContext Error]', err);
          setLoading(false);
        }
      }
    );

    return () => {
      isCancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [userId, triggerToast]);

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !n.read);
  }, [notifications]);

  const unreadCount = unreadNotifications.length;

  const handleMarkAsRead = useCallback(async (notificationId) => {
    await markNotificationAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead(notifications);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [notifications]);

  const handleDeleteNotif = useCallback(async (notificationId) => {
    await deleteNotification(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      unreadNotifications,
      loading,
      toasts,
      triggerToast,
      dismissToast,
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead,
      deleteNotif: handleDeleteNotif,
    }),
    [
      notifications,
      unreadCount,
      unreadNotifications,
      loading,
      toasts,
      triggerToast,
      dismissToast,
      handleMarkAsRead,
      handleMarkAllAsRead,
      handleDeleteNotif,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
