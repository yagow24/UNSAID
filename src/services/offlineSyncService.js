/**
 * Offline Sync Engine & Queue Management
 * 
 * Provides local queues for offline operations:
 * 1. Complaints / Problems Queue
 * 2. Daily Pulse Votes Queue
 * 3. Comments / Messages Queue
 * 
 * Guarantees:
 * - Automatic background sync upon network reconnection
 * - Idempotency key tracking to strictly eliminate duplicate submissions
 * - Real-time queue metrics and sync status notifications
 */

import { collection, doc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const QUEUE_PROBLEMS_KEY = 'unsaid_offline_problems_queue';
const QUEUE_PULSE_KEY = 'unsaid_offline_pulse_queue';
const QUEUE_MESSAGES_KEY = 'unsaid_offline_messages_queue';
const SYNCED_KEYS_SET_KEY = 'unsaid_synced_idempotency_keys';

let isSyncingInProgress = false;

// Helper to safely read from localStorage
const getQueue = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Helper to safely save to localStorage
const setQueue = (key, items) => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    notifyQueueChange();
  } catch (err) {
    console.warn('[UNSAID Offline Queue] Storage write error:', err);
  }
};

// Dispatches an event so hooks/UI can update reactively
const notifyQueueChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('unsaid_offline_queue_changed'));
  }
};

// Idempotency tracking
const getSyncedKeys = () => {
  try {
    const raw = localStorage.getItem(SYNCED_KEYS_SET_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const markKeyAsSynced = (idempotencyKey) => {
  if (!idempotencyKey) return;
  try {
    const keys = getSyncedKeys();
    keys.add(idempotencyKey);
    // Keep last 500 keys to prevent localStorage bloat
    const arrayKeys = Array.from(keys).slice(-500);
    localStorage.setItem(SYNCED_KEYS_SET_KEY, JSON.stringify(arrayKeys));
  } catch {}
};

export const isKeyAlreadySynced = (idempotencyKey) => {
  if (!idempotencyKey) return false;
  return getSyncedKeys().has(idempotencyKey);
};

// Generate deterministic/unique idempotency key
export const generateIdempotencyKey = (prefix = 'item') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 1. ENQUEUE PROBLEM (Offline query submission)
 */
export const enqueueOfflineProblem = (problemData) => {
  const idempotencyKey = problemData.idempotencyKey || generateIdempotencyKey('prob');
  const queue = getQueue(QUEUE_PROBLEMS_KEY);

  // Prevent duplicate if already in queue
  if (queue.some((item) => item.idempotencyKey === idempotencyKey)) {
    return;
  }

  const queuedItem = {
    idempotencyKey,
    data: problemData,
    enqueuedAt: new Date().toISOString(),
  };

  setQueue(QUEUE_PROBLEMS_KEY, [...queue, queuedItem]);
  return queuedItem;
};

/**
 * 2. ENQUEUE DAILY PULSE (Offline pulse vote)
 */
export const enqueueOfflinePulse = (pulseData) => {
  const idempotencyKey = pulseData.idempotencyKey || generateIdempotencyKey('pulse');
  const queue = getQueue(QUEUE_PULSE_KEY);

  if (queue.some((item) => item.idempotencyKey === idempotencyKey)) {
    return;
  }

  const queuedItem = {
    idempotencyKey,
    data: pulseData,
    enqueuedAt: new Date().toISOString(),
  };

  setQueue(QUEUE_PULSE_KEY, [...queue, queuedItem]);
  return queuedItem;
};

/**
 * 3. ENQUEUE MESSAGE (Offline comment/message)
 */
export const enqueueOfflineMessage = (messageData) => {
  const idempotencyKey = messageData.idempotencyKey || generateIdempotencyKey('msg');
  const queue = getQueue(QUEUE_MESSAGES_KEY);

  if (queue.some((item) => item.idempotencyKey === idempotencyKey)) {
    return;
  }

  const queuedItem = {
    idempotencyKey,
    data: messageData,
    enqueuedAt: new Date().toISOString(),
  };

  setQueue(QUEUE_MESSAGES_KEY, [...queue, queuedItem]);
  return queuedItem;
};

/**
 * Returns current counts of all pending offline items.
 */
export const getPendingQueueCounts = () => {
  const problems = getQueue(QUEUE_PROBLEMS_KEY).length;
  const pulse = getQueue(QUEUE_PULSE_KEY).length;
  const messages = getQueue(QUEUE_MESSAGES_KEY).length;
  return {
    problems,
    pulse,
    messages,
    total: problems + pulse + messages,
  };
};

/**
 * Drains all queues and synchronizes pending records to real Firestore.
 */
export const syncAllOfflineData = async () => {
  if (isSyncingInProgress) return { status: 'already_running' };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { status: 'offline' };
  }
  if (!db) {
    return { status: 'db_unavailable' };
  }

  isSyncingInProgress = true;
  notifyQueueChange();

  let syncedCount = 0;

  try {
    // 1. Sync Problems Queue
    const problemsQueue = getQueue(QUEUE_PROBLEMS_KEY);
    const remainingProblems = [];

    for (const item of problemsQueue) {
      if (isKeyAlreadySynced(item.idempotencyKey)) {
        continue;
      }
      try {
        const probPayload = {
          ...item.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          syncedFromOffline: true,
        };
        delete probPayload.idempotencyKey;

        const probRef = collection(db, 'problems');
        await addDoc(probRef, probPayload);
        markKeyAsSynced(item.idempotencyKey);
        syncedCount++;
      } catch (err) {
        console.warn('[UNSAID Offline Sync] Problem sync retry later:', err);
        remainingProblems.push(item);
      }
    }
    setQueue(QUEUE_PROBLEMS_KEY, remainingProblems);

    // 2. Sync Pulse Queue
    const pulseQueue = getQueue(QUEUE_PULSE_KEY);
    const remainingPulse = [];

    for (const item of pulseQueue) {
      if (isKeyAlreadySynced(item.idempotencyKey)) {
        continue;
      }
      try {
        const pulseDocId =
          item.data.docId ||
          item.data.id ||
          `${item.data.userId}_${item.data.workspaceId}_${item.data.dateKey || item.data.dateStr}`;
        const pulsePayload = {
          ...item.data,
          createdAt: serverTimestamp(),
          syncedFromOffline: true,
        };
        delete pulsePayload.idempotencyKey;
        delete pulsePayload.docId;

        const checkinRef = doc(db, 'checkins', pulseDocId);
        await setDoc(checkinRef, pulsePayload);
        markKeyAsSynced(item.idempotencyKey);
        syncedCount++;
      } catch (err) {
        console.warn('[UNSAID Offline Sync] Pulse sync retry later:', err);
        remainingPulse.push(item);
      }
    }
    setQueue(QUEUE_PULSE_KEY, remainingPulse);

    // 3. Sync Messages Queue
    const messagesQueue = getQueue(QUEUE_MESSAGES_KEY);
    const remainingMessages = [];

    for (const item of messagesQueue) {
      if (isKeyAlreadySynced(item.idempotencyKey)) {
        continue;
      }
      try {
        const msgPayload = {
          ...item.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          syncedFromOffline: true,
        };
        delete msgPayload.idempotencyKey;

        const msgRef = collection(db, 'problemMessages');
        await addDoc(msgRef, msgPayload);
        markKeyAsSynced(item.idempotencyKey);
        syncedCount++;
      } catch (err) {
        console.warn('[UNSAID Offline Sync] Message sync retry later:', err);
        remainingMessages.push(item);
      }
    }
    setQueue(QUEUE_MESSAGES_KEY, remainingMessages);

    return { status: 'success', syncedCount };
  } finally {
    isSyncingInProgress = false;
    notifyQueueChange();
  }
};
