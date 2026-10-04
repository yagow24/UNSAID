import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Service for managing workspace join requests.
 * Uses the canonical Firestore collection 'workspaceRequests'
 * with deterministic document ID: `${userId}_${workspaceId}`.
 */

/**
 * Subscribes to real-time pending join requests for a specific workspace.
 * Filtered by: workspaceId == selectedWorkspaceId AND status == 'pending'.
 *
 * @param {string} workspaceId - The target workspace ID.
 * @param {function} onNext - Callback receiving array of pending request documents.
 * @param {function} onError - Optional error callback.
 * @returns {function} Unsubscribe function.
 */
export const subscribeToPendingWorkspaceRequests = (workspaceId, onNext, onError) => {
  if (!db || !workspaceId) {
    if (typeof onNext === 'function') onNext([]);
    return () => {};
  }

  const reqRef = collection(db, 'workspaceRequests');
  const q = query(
    reqRef,
    where('workspaceId', '==', workspaceId),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort newest requested first
      requests.sort((a, b) => {
        const timeA =
          a.createdAt?.toMillis?.() || a.requestedAt?.toMillis?.() || 0;
        const timeB =
          b.createdAt?.toMillis?.() || b.requestedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      if (typeof onNext === 'function') {
        onNext(requests);
      }
    },
    (err) => {
      console.error('[UNSAID Pending Requests Subscription Error]', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
};

/**
 * Subscribes to all join requests for a specific workspace (pending, approved, rejected).
 *
 * @param {string} workspaceId - The target workspace ID.
 * @param {function} onNext - Callback receiving array of all request documents.
 * @param {function} onError - Optional error callback.
 * @returns {function} Unsubscribe function.
 */
export const subscribeToAllWorkspaceRequests = (workspaceId, onNext, onError) => {
  if (!db || !workspaceId) {
    if (typeof onNext === 'function') onNext([]);
    return () => {};
  }

  const reqRef = collection(db, 'workspaceRequests');
  const q = query(reqRef, where('workspaceId', '==', workspaceId));

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort newest requested first
      requests.sort((a, b) => {
        const timeA =
          a.createdAt?.toMillis?.() || a.requestedAt?.toMillis?.() || 0;
        const timeB =
          b.createdAt?.toMillis?.() || b.requestedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      if (typeof onNext === 'function') {
        onNext(requests);
      }
    },
    (err) => {
      console.error('[UNSAID All Requests Subscription Error]', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
};

/**
 * Subscribes to a specific user's join request for a workspace in real time.
 *
 * @param {string} userId - User's Firebase UID.
 * @param {string} workspaceId - Workspace ID.
 * @param {function} onNext - Callback receiving request document or null.
 * @param {function} onError - Optional error callback.
 * @returns {function} Unsubscribe function.
 */
export const subscribeToUserJoinRequest = (userId, workspaceId, onNext, onError) => {
  if (!db || !userId || !workspaceId) {
    if (typeof onNext === 'function') onNext(null);
    return () => {};
  }

  const reqDocId = `${userId}_${workspaceId}`;
  const reqDocRef = doc(db, 'workspaceRequests', reqDocId);

  return onSnapshot(
    reqDocRef,
    (docSnap) => {
      if (docSnap.exists()) {
        if (typeof onNext === 'function') {
          onNext({ id: docSnap.id, ...docSnap.data() });
        }
      } else {
        if (typeof onNext === 'function') {
          onNext(null);
        }
      }
    },
    (err) => {
      console.warn('[UNSAID User Request Subscription Error]', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  );
};

/**
 * Creates a join request in the canonical 'workspaceRequests' collection.
 * Uses deterministic requestId: `${userId}_${workspaceId}`.
 */
export const createWorkspaceJoinRequest = async ({
  userId,
  userName,
  userEmail,
  workspaceId,
  workspaceName,
  inviteId = null,
  inviteToken = null,
}) => {
  if (!db) {
    throw new Error('Database service unavailable.');
  }
  if (!userId) {
    throw new Error('You must be signed in to request access to this workspace.');
  }
  if (!workspaceId) {
    throw new Error('Target workspace ID is required.');
  }
  if (!inviteId || !inviteToken) {
    throw new Error('A valid workspace invitation is required to request access.');
  }

  const reqDocId = `${userId}_${workspaceId}`;
  const reqDocRef = doc(db, 'workspaceRequests', reqDocId);
  const memberDocRef = doc(db, 'workspaceMembers', reqDocId);
  const workspaceDocRef = doc(db, 'workspaces', workspaceId);
  const inviteDocRef = doc(db, 'workspaceInvites', inviteId);
  const requestData = {
    userId,
    userName: userName || 'UNSAID Member',
    userEmail: (userEmail || '').trim().toLowerCase(),
    workspaceId,
    workspaceName: workspaceName || 'Workspace',
    inviteId: inviteId || null,
    inviteToken: inviteToken || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    requestedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
  };

  return runTransaction(db, async (transaction) => {
    const [requestSnap, memberSnap, workspaceSnap, inviteSnap] = await Promise.all([
      transaction.get(reqDocRef),
      transaction.get(memberDocRef),
      transaction.get(workspaceDocRef),
      transaction.get(inviteDocRef),
    ]);

    if (memberSnap.exists() && memberSnap.data().status === 'active') {
      return {
        id: reqDocId,
        status: 'already_member',
        message: "You're already an active member of this workspace.",
      };
    }

    if (requestSnap.exists() && requestSnap.data().status === 'pending') {
      return {
        id: reqDocId,
        ...requestSnap.data(),
        status: 'pending',
        alreadyPending: true,
        message: 'Join request already sent.',
      };
    }

    const workspace = workspaceSnap.exists() ? workspaceSnap.data() : null;
    if (!workspace || workspace.status !== 'active') {
      throw new Error('This workspace is not available.');
    }

    const invite = inviteSnap.exists() ? inviteSnap.data() : null;
    if (
      !invite ||
      invite.token !== inviteToken ||
      invite.workspaceId !== workspaceId ||
      invite.status !== 'active'
    ) {
      throw new Error('This invitation is invalid or has been revoked.');
    }

    const expiresAt = invite.expiresAt?.toMillis?.() ?? null;
    if (expiresAt !== null && expiresAt <= Date.now()) {
      throw new Error('This workspace invitation has expired.');
    }
    if (
      Number.isFinite(invite.maxUses) &&
      Number(invite.usedCount || 0) >= Number(invite.maxUses)
    ) {
      throw new Error('This workspace invitation has reached its usage limit.');
    }

    if (requestSnap.exists() && requestSnap.data().status === 'approved') {
      throw new Error('This request was already approved. Contact the workspace administrator if access is missing.');
    }

    if (requestSnap.exists() && requestSnap.data().status === 'rejected') {
      transaction.update(reqDocRef, {
        ...requestData,
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
      });
    } else {
      transaction.set(reqDocRef, requestData);
    }

    return {
      id: reqDocId,
      status: 'pending',
      success: true,
      message: 'Request sent',
    };
  });
};

/**
 * Approves a join request using an atomic batch write.
 * Sets request status to 'approved' and creates/activates workspaceMembers document.
 */
export const approveWorkspaceJoinRequest = async ({
  requestId,
  workspaceId,
  targetUserId,
  adminUid,
}) => {
  if (!db) {
    throw new Error('Database service unavailable.');
  }
  if (!requestId || !workspaceId || !targetUserId || !adminUid) {
    throw new Error('Missing required arguments to approve join request.');
  }

  const reqDocRef = doc(db, 'workspaceRequests', requestId);
  const memberDocId = `${targetUserId}_${workspaceId}`;
  const memberDocRef = doc(db, 'workspaceMembers', memberDocId);
  const notificationRef = doc(collection(db, 'notifications'));

  return runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqDocRef);
    if (!reqSnap.exists()) {
      throw new Error('Join request not found.');
    }

    const reqData = reqSnap.data();
    if (reqData.workspaceId !== workspaceId || reqData.userId !== targetUserId) {
      throw new Error('Security violation: Request does not belong to the target workspace or user.');
    }
    if (reqData.status !== 'pending') {
      throw new Error(`This request has already been ${reqData.status}.`);
    }

    const [memberSnap, inviteSnap] = await Promise.all([
      transaction.get(memberDocRef),
      reqData.inviteId
        ? transaction.get(doc(db, 'workspaceInvites', reqData.inviteId))
        : Promise.resolve(null),
    ]);
    const invite = inviteSnap?.exists() ? inviteSnap.data() : null;

    if (invite && invite.maxUses && Number(invite.usedCount || 0) >= Number(invite.maxUses)) {
      throw new Error('This invitation has reached its usage limit.');
    }

    transaction.update(reqDocRef, {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy: adminUid,
      rejectedAt: null,
      rejectedBy: null,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      updatedAt: serverTimestamp(),
    });

    if (!memberSnap.exists() || memberSnap.data().status !== 'active') {
      transaction.set(memberDocRef, {
        userId: targetUserId,
        workspaceId,
        role: 'member',
        status: 'active',
        joinedAt: serverTimestamp(),
        createdAt: memberSnap?.exists() ? memberSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    transaction.set(notificationRef, {
      userId: targetUserId,
      type: 'request_approved',
      title: 'Request Approved',
      message: `Your request to join "${reqData.workspaceName || 'the workspace'}" has been approved by the administrator.`,
      requestId,
      workspaceId,
      workspaceName: reqData.workspaceName || 'Workspace',
      read: false,
      createdAt: serverTimestamp(),
    });

    if (invite && invite.status === 'active') {
      transaction.update(doc(db, 'workspaceInvites', reqData.inviteId), {
        usedCount: Number(invite.usedCount || 0) + 1,
      });
    }

    return true;
  });
};

/**
 * Rejects a join request.
 * Sets request status to 'rejected'. Does NOT delete the request document.
 * Creates a notification for the requesting user.
 */
export const rejectWorkspaceJoinRequest = async ({
  requestId,
  workspaceId,
  adminUid,
}) => {
  if (!db) {
    throw new Error('Database service unavailable.');
  }
  if (!requestId || !workspaceId || !adminUid) {
    throw new Error('Missing required arguments to reject join request.');
  }

  const reqDocRef = doc(db, 'workspaceRequests', requestId);
  const notificationRef = doc(collection(db, 'notifications'));

  return runTransaction(db, async (transaction) => {
    const reqSnap = await transaction.get(reqDocRef);
    if (!reqSnap.exists()) {
      throw new Error('Join request not found.');
    }

    const reqData = reqSnap.data();
    if (reqData.workspaceId !== workspaceId) {
      throw new Error('Security violation: Request does not belong to the target workspace.');
    }
    if (reqData.status !== 'pending') {
      throw new Error(`This request has already been ${reqData.status}.`);
    }

    transaction.update(reqDocRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp(),
      rejectedBy: adminUid,
      approvedAt: null,
      approvedBy: null,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      updatedAt: serverTimestamp(),
    });

    transaction.set(notificationRef, {
      userId: reqData.userId,
      type: 'request_rejected',
      title: 'Request Rejected',
      message: `Your request to join "${reqData.workspaceName || 'the workspace'}" has been rejected by the administrator.`,
      requestId,
      workspaceId,
      workspaceName: reqData.workspaceName || 'Workspace',
      read: false,
      createdAt: serverTimestamp(),
    });

    return true;
  });
};
