import { createContext } from 'react';

export const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  unreadNotifications: [],
  loading: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotif: async () => {},
});
