import { useState, useEffect, useCallback } from 'react';
import {
  getPendingQueueCounts,
  syncAllOfflineData,
} from '../services/offlineSyncService';

/**
 * Hook for managing offline state, pending local queues, and sync lifecycle.
 */
export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueCounts, setQueueCounts] = useState(() => getPendingQueueCounts());
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const updateCounts = useCallback(() => {
    setQueueCounts(getPendingQueueCounts());
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const res = await syncAllOfflineData();
      setLastSyncResult(res);
      updateCounts();
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [updateCounts]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleQueueChange = () => {
      updateCounts();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('unsaid_offline_queue_changed', handleQueueChange);

    // Initial sync check if online and pending items exist
    if (typeof navigator !== 'undefined' && navigator.onLine && queueCounts.total > 0) {
      queueMicrotask(() => {
        triggerSync();
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('unsaid_offline_queue_changed', handleQueueChange);
    };
  }, [triggerSync, updateCounts, queueCounts.total]);

  return {
    isOnline,
    isSyncing,
    queueCounts,
    lastSyncResult,
    triggerSync,
  };
};
