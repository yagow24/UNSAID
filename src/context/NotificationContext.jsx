import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  const userId = currentUser?.uid;

  useEffect(() => {
    let isCancelled = false;

    if (!userId) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setNotifications([]);
          setLoading(false);
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
        if (!isCancelled) {
          setNotifications(data);
          setLoading(false);
        }
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
  }, [userId]);

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
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead,
      deleteNotif: handleDeleteNotif,
    }),
    [
      notifications,
      unreadCount,
      unreadNotifications,
      loading,
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
