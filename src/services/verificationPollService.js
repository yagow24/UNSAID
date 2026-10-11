import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const POLLS_COLLECTION = 'resolutionVerificationPolls';
const VOTES_COLLECTION = 'resolutionVerificationVotes';
const LOCAL_STORAGE_POLL_PREFIX = 'unsaid_res_poll_';
const LOCAL_STORAGE_VOTES_PREFIX = 'unsaid_res_votes_';

export const VERIFICATION_OPTIONS = ['Solved', 'Partially Solved', 'Not Solved'];

/**
 * Helper to retrieve locally cached poll data.
 */
const getLocalPoll = (problemId) => {
  if (!problemId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_POLL_PREFIX}${problemId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveLocalPoll = (problemId, poll) => {
  if (!problemId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_POLL_PREFIX}${problemId}`, JSON.stringify(poll));
  } catch {}
};

const getLocalVotes = (problemId) => {
  if (!problemId || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_VOTES_PREFIX}${problemId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalVotes = (problemId, votes) => {
  if (!problemId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_VOTES_PREFIX}${problemId}`, JSON.stringify(votes));
  } catch {}
};

/**
 * Creates or activates a Resolution Verification Poll linked to a specific problem and cycle.
 * Authorized for workspace administrators publishing an official resolution.
 * Prevents duplicate polls on rapid clicks/retries.
 */
export const createOrActivateVerificationPoll = async ({
  problemId,
  workspaceId,
  resolutionText,
  actionTaken = '',
  adminUser,
  adminProfile,
  eligibleReporterIds = [],
}) => {
  if (!problemId || !workspaceId) {
    throw new Error('Problem ID and Workspace ID are required for verification poll.');
  }

  // Deduplicate and filter valid reporter IDs
  const uniqueReporters = Array.from(
    new Set((eligibleReporterIds || []).filter((id) => typeof id === 'string' && id.trim().length > 0))
  );

  const cleanText = (resolutionText || '').trim();
  const cleanAction = (actionTaken || '').trim();
  const resolverId = adminUser?.uid || 'admin';
  const resolverName = adminProfile?.fullName || adminUser?.displayName || 'Workspace Admin';

  const pollDocRef = db ? doc(db, POLLS_COLLECTION, problemId) : null;
  let existingPoll = null;

  if (pollDocRef) {
    try {
      const snap = await getDoc(pollDocRef);
      if (snap.exists()) {
        existingPoll = snap.data();
      }
    } catch (err) {
      console.warn('[UNSAID Verification Poll] Error checking existing poll:', err);
    }
  }

  if (!existingPoll) {
    existingPoll = getLocalPoll(problemId);
  }

  // Prevent duplicate polls if published again with the same resolution text while active
  if (
    existingPoll &&
    existingPoll.status === 'active' &&
    existingPoll.resolutionText === cleanText &&
    existingPoll.resolutionCycleId
  ) {
    // Merge any new eligible reporters without creating a new cycle
    const mergedReporters = Array.from(
      new Set([...(existingPoll.eligibleReporterIds || []), ...uniqueReporters])
    );

    const updatedPoll = {
      ...existingPoll,
      eligibleReporterIds: mergedReporters,
      actionTaken: cleanAction || existingPoll.actionTaken,
      updatedAt: new Date().toISOString(),
    };

    saveLocalPoll(problemId, updatedPoll);

    if (pollDocRef) {
      await updateDoc(pollDocRef, {
        eligibleReporterIds: mergedReporters,
        actionTaken: cleanAction || existingPoll.actionTaken,
        updatedAt: serverTimestamp(),
      });
    }

    return { id: problemId, ...updatedPoll };
  }

  // If a previous poll cycle existed, archive it to preserve audit history
  const historyCycles = Array.isArray(existingPoll?.resolutionCycles)
    ? [...existingPoll.resolutionCycles]
    : [];

  if (existingPoll?.resolutionCycleId) {
    historyCycles.push({
      resolutionCycleId: existingPoll.resolutionCycleId,
      resolutionText: existingPoll.resolutionText,
      actionTaken: existingPoll.actionTaken || '',
      resolvedBy: existingPoll.resolvedBy,
      resolvedByName: existingPoll.resolvedByName,
      resolvedAt: existingPoll.resolvedAt,
      verificationStatus: existingPoll.verificationStatus || 'reopened',
      closedAt: new Date().toISOString(),
      eligibleReporterIds: existingPoll.eligibleReporterIds || [],
    });
  }

  // New resolution cycle ID
  const resolutionCycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newPollData = {
    id: problemId,
    problemId,
    workspaceId,
    resolutionCycleId,
    resolutionText: cleanText,
    actionTaken: cleanAction,
    resolvedBy: resolverId,
    resolvedByName: resolverName,
    resolvedAt: new Date().toISOString(),
    question: 'Has this problem been resolved for you?',
    options: VERIFICATION_OPTIONS,
    eligibleReporterIds: uniqueReporters,
    status: 'active', // 'active' | 'closed'
    verificationStatus: 'pending', // 'pending' | 'verified' | 'rejected'
    resolutionCycles: historyCycles,
    createdAt: existingPoll?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveLocalPoll(problemId, newPollData);

  if (pollDocRef) {
    await setDoc(pollDocRef, {
      ...newPollData,
      createdAt: existingPoll?.createdAt ? existingPoll.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return newPollData;
};

/**
 * Subscribes to the Resolution Verification Poll for a problem in real-time.
 */
export const subscribeToVerificationPoll = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate(null);
    return () => {};
  }

  const local = getLocalPoll(problemId);
  if (local && onUpdate) {
    onUpdate(local);
  }

  if (!db) return () => {};

  try {
    const pollDocRef = doc(db, POLLS_COLLECTION, problemId);
    const unsubscribe = onSnapshot(
      pollDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const poll = { id: snapshot.id, ...snapshot.data() };
          saveLocalPoll(problemId, poll);
          if (onUpdate) onUpdate(poll);
        } else {
          if (onUpdate) onUpdate(null);
        }
      },
      (err) => {
        console.warn('[UNSAID Verification Poll] Poll subscription warning:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Verification Poll] Listener setup failed:', err);
    return () => {};
  }
};

/**
 * Subscribes to all votes cast for a problem's active resolution cycle in real-time.
 * Computes exact tallies, percentages, and lists of pending/voted reporters.
 */
export const subscribeToVerificationVotes = (problemId, resolutionCycleId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) {
      onUpdate({
        votes: [],
        counts: { Solved: 0, 'Partially Solved': 0, 'Not Solved': 0 },
        percentages: { Solved: 0, 'Partially Solved': 0, 'Not Solved': 0 },
        votedUserIds: [],
        rejections: [],
      });
    }
    return () => {};
  }

  const localVotes = getLocalVotes(problemId).filter(
    (v) => !resolutionCycleId || v.resolutionCycleId === resolutionCycleId
  );
  if (localVotes.length > 0 && onUpdate) {
    onUpdate(calculateVotesStats(localVotes));
  }

  if (!db) return () => {};

  try {
    const votesRef = collection(db, VOTES_COLLECTION);
    const q = query(votesRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allVotes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        saveLocalVotes(problemId, allVotes);

        // Filter votes matching active resolution cycle
        const cycleVotes = resolutionCycleId
          ? allVotes.filter((v) => v.resolutionCycleId === resolutionCycleId)
          : allVotes;

        const stats = calculateVotesStats(cycleVotes);
        if (onUpdate) onUpdate(stats);
      },
      (err) => {
        console.warn('[UNSAID Verification Votes] Subscription warning:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Verification Votes] Listener setup failed:', err);
    return () => {};
  }
};

/**
 * Helper to compute vote statistics.
 */
const calculateVotesStats = (votes) => {
  const counts = { Solved: 0, 'Partially Solved': 0, 'Not Solved': 0 };
  const votedUserIds = [];
  const rejections = [];

  for (const v of votes) {
    if (v.selectedOption && counts[v.selectedOption] !== undefined) {
      counts[v.selectedOption]++;
    }
    if (v.userId && !votedUserIds.includes(v.userId)) {
      votedUserIds.push(v.userId);
    }
    if (v.selectedOption === 'Partially Solved' || v.selectedOption === 'Not Solved') {
      rejections.push({
        userId: v.userId,
        userName: v.userName || 'Member',
        selectedOption: v.selectedOption,
        votedAt: v.updatedAt || v.createdAt,
      });
    }
  }

  const total = votes.length;
  const percentages = {
    Solved: total > 0 ? Math.round((counts.Solved / total) * 100) : 0,
    'Partially Solved': total > 0 ? Math.round((counts['Partially Solved'] / total) * 100) : 0,
    'Not Solved': total > 0 ? Math.round((counts['Not Solved'] / total) * 100) : 0,
  };

  return {
    votes,
    counts,
    percentages,
    votedUserIds,
    rejections,
    totalVotes: total,
  };
};

/**
 * Submits a vote on the Resolution Verification Poll.
 * Enforces strict eligibility: user must be in eligibleReporterIds.
 * Deterministic doc ID `${problemId}_${resolutionCycleId}_${userId}` guarantees 1 vote per user per cycle.
 */
export const submitVerificationVote = async ({
  problemId,
  workspaceId,
  resolutionCycleId,
  selectedOption,
  currentUser,
  userProfile,
}) => {
  if (!problemId || !workspaceId || !selectedOption) {
    throw new Error('Problem ID, workspace ID, and selected option are required to vote.');
  }
  if (!currentUser?.uid) {
    throw new Error('You must be signed in to submit a verification vote.');
  }
  if (!VERIFICATION_OPTIONS.includes(selectedOption)) {
    throw new Error(`Invalid vote option. Must be one of: ${VERIFICATION_OPTIONS.join(', ')}`);
  }

  let poll = null;
  const pollDocRef = db ? doc(db, POLLS_COLLECTION, problemId) : null;

  if (pollDocRef) {
    const snap = await getDoc(pollDocRef);
    if (!snap.exists()) {
      throw new Error('Verification poll not found for this problem.');
    }
    poll = snap.data();
  } else {
    poll = getLocalPoll(problemId);
  }

  if (!poll) {
    throw new Error('Verification poll not found.');
  }

  if (poll.status !== 'active') {
    throw new Error('This resolution verification poll is closed. Voting is no longer active.');
  }

  const activeCycle = resolutionCycleId || poll.resolutionCycleId;
  if (!activeCycle) {
    throw new Error('Active resolution cycle is missing.');
  }

  // STRICT VOTER ELIGIBILITY:
  const eligibleReporters = poll.eligibleReporterIds || [];
  if (!eligibleReporters.includes(currentUser.uid)) {
    throw new Error(
      'Voting is restricted to the original reporters and members recorded as affected by this issue.'
    );
  }

  const voteDocId = `${problemId}_${activeCycle}_${currentUser.uid}`;
  const voteDocRef = db ? doc(db, VOTES_COLLECTION, voteDocId) : null;

  const voteData = {
    id: voteDocId,
    pollId: problemId,
    problemId,
    workspaceId,
    resolutionCycleId: activeCycle,
    userId: currentUser.uid,
    userName: userProfile?.fullName || currentUser.displayName || 'Member',
    userEmail: currentUser.email || '',
    selectedOption,
    updatedAt: new Date().toISOString(),
  };

  // Update local storage cache
  const localVotes = getLocalVotes(problemId);
  const updatedLocalVotes = [
    voteData,
    ...localVotes.filter((v) => v.id !== voteDocId && !(v.problemId === problemId && v.resolutionCycleId === activeCycle && v.userId === currentUser.uid)),
  ];
  saveLocalVotes(problemId, updatedLocalVotes);

  if (voteDocRef) {
    await setDoc(
      voteDocRef,
      {
        ...voteData,
        createdAt: voteData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Notify the resolving administrator of the new vote
    try {
      const targetAdmin = poll.resolvedBy;
      if (targetAdmin && targetAdmin !== currentUser.uid) {
        const notifRef = doc(collection(db, 'notifications'));
        await setDoc(notifRef, {
          userId: targetAdmin,
          type: 'verification_vote_submitted',
          title: 'Verification Vote Cast',
          message: `${voteData.userName} voted "${selectedOption}" on resolution cycle.`,
          problemId,
          workspaceId,
          resolutionCycleId: activeCycle,
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      // Confirmation notification for the voter
      const userNotifRef = doc(collection(db, 'notifications'));
      await setDoc(userNotifRef, {
        userId: currentUser.uid,
        type: 'verification_vote_confirmed',
        title: 'Verification Vote Recorded',
        message: `Your verification vote "${selectedOption}" has been recorded.`,
        problemId,
        workspaceId,
        resolutionCycleId: activeCycle,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (notifErr) {
      console.warn('[UNSAID Verification] Vote notification notice:', notifErr.message);
    }
  }

  return voteData;
};

/**
 * Evaluates the votes for an active resolution cycle and applies unanimous verification or automatic reopen workflow.
 * 
 * Rules:
 * 1. Unanimous Solved: If ALL eligible reporters vote "Solved", resolution cycle is marked verified and problem is marked solved.
 * 2. Any Partially Solved / Not Solved: Immediately triggers the reopen workflow; problem status is reset to 'open'.
 * 3. Pending: Pending votes never count as Solved.
 */
export const evaluateAndApplyVerificationOutcome = async ({
  problemId,
  workspaceId,
  resolutionCycleId,
  poll,
  votes,
  adminUser,
  currentUser,
}) => {
  if (!problemId || !poll || !Array.isArray(votes)) return null;

  const cycleId = resolutionCycleId || poll.resolutionCycleId;
  const cycleVotes = votes.filter((v) => v.resolutionCycleId === cycleId);
  const eligibleReporters = poll.eligibleReporterIds || [];
  const totalEligible = eligibleReporters.length;
  if (totalEligible === 0) {
    return {
      status: 'pending',
      outcome: 'no_eligible_reporters',
      totalEligible: 0,
      votedCount: 0,
      pendingCount: 0,
      notice: 'No eligible reporters are recorded for this problem. Resolution cannot be automatically verified.',
    };
  }

  // 1. Check for any non-solved response (Partially Solved or Not Solved)
  const rejectionVotes = cycleVotes.filter(
    (v) => v.selectedOption === 'Partially Solved' || v.selectedOption === 'Not Solved'
  );

  if (rejectionVotes.length > 0) {
    // REOPEN WORKFLOW TRIGGERED
    const rejectNames = rejectionVotes.map((v) => `${v.userName} (${v.selectedOption})`).join(', ');
    const reopenNotice = `Verification not confirmed: ${rejectNames}. Problem has been reopened for resolution.`;

    const pollUpdate = {
      status: 'closed',
      verificationStatus: 'rejected',
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLocalPoll(problemId, { ...poll, ...pollUpdate });

    if (db) {
      try {
        const pollRef = doc(db, POLLS_COLLECTION, problemId);
        await updateDoc(pollRef, {
          status: 'closed',
          verificationStatus: 'rejected',
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[UNSAID Verification] Poll reopen update notice:', err);
      }

      try {
        const probRef = doc(db, 'problems', problemId);
        await updateDoc(probRef, {
          status: 'open',
          verificationStatus: 'reopened',
          reopenReason: reopenNotice,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[UNSAID Verification] Problem reopen update notice:', err);
      }

      // Notify the resolving admin
      try {
        const targetAdminId = poll.resolvedBy || adminUser?.uid;
        if (targetAdminId) {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            userId: targetAdminId,
            type: 'resolution_reopened',
            title: 'Query Reopened by Reporter',
            message: `${rejectNames} reported the resolution was not fully solved in "${poll.resolutionText}".`,
            problemId,
            workspaceId: workspaceId || poll.workspaceId,
            read: false,
            createdAt: serverTimestamp(),
          });
        }

        // Also notify all eligible reporters that the query has been reopened
        for (const rId of eligibleReporters) {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            userId: rId,
            type: 'resolution_reopened',
            title: 'Resolution Reopened for Action',
            message: `Feedback was received on "${poll.resolutionText}". Staff has been notified to re-evaluate.`,
            problemId,
            workspaceId: workspaceId || poll.workspaceId,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (notifErr) {
        console.warn('[UNSAID Verification] Reopen notification dispatch notice:', notifErr.message);
      }
    }

    return {
      status: 'reopened',
      outcome: 'rejected',
      rejectionVotes,
      notice: reopenNotice,
    };
  }

  // 2. Check for Unanimous Solved
  const solvedVotes = cycleVotes.filter((v) => v.selectedOption === 'Solved');
  const votedUserIds = Array.from(new Set(solvedVotes.map((v) => v.userId)));

  // All eligible reporters must have cast a vote and every one is "Solved"
  const isUnanimous =
    totalEligible > 0 &&
    votedUserIds.length === totalEligible &&
    eligibleReporters.every((uid) => votedUserIds.includes(uid));

  if (isUnanimous) {
    // UNANIMOUS VERIFICATION CONFIRMED
    const verifiedNotice = `Resolution unanimously verified by all ${totalEligible} eligible reporter(s). Marked officially solved.`;

    const pollUpdate = {
      status: 'closed',
      verificationStatus: 'verified',
      verifiedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveLocalPoll(problemId, { ...poll, ...pollUpdate });

    if (db) {
      try {
        const pollRef = doc(db, POLLS_COLLECTION, problemId);
        await updateDoc(pollRef, {
          status: 'closed',
          verificationStatus: 'verified',
          verifiedAt: serverTimestamp(),
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[UNSAID Verification] Poll verified update notice:', err);
      }

      try {
        const probRef = doc(db, 'problems', problemId);
        await updateDoc(probRef, {
          status: 'solved',
          verificationStatus: 'verified',
          verifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[UNSAID Verification] Problem verified update notice:', err);
      }

      // Notify the resolving admin
      try {
        const targetAdminId = poll.resolvedBy || adminUser?.uid;
        if (targetAdminId) {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            userId: targetAdminId,
            type: 'resolution_verified',
            title: '✅ Resolution Unanimously Verified',
            message: `All ${totalEligible} eligible reporters verified "${poll.resolutionText}" as Solved.`,
            problemId,
            workspaceId: workspaceId || poll.workspaceId,
            read: false,
            createdAt: serverTimestamp(),
          });
        }

        // Also notify all eligible reporters that the query is officially Solved
        for (const rId of eligibleReporters) {
          const notifRef = doc(collection(db, 'notifications'));
          await setDoc(notifRef, {
            userId: rId,
            type: 'resolution_verified',
            title: '🎉 Query Officially Solved',
            message: `All reporters verified the resolution for "${poll.resolutionText}". Query is marked Solved!`,
            problemId,
            workspaceId: workspaceId || poll.workspaceId,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (notifErr) {
        console.warn('[UNSAID Verification] Verified notification dispatch notice:', notifErr.message);
      }
    }

    return {
      status: 'verified',
      outcome: 'verified',
      totalEligible,
      notice: verifiedNotice,
    };
  }

  // 3. Otherwise: Pending verification (waiting for remaining eligible reporters)
  const pendingCount = Math.max(0, totalEligible - votedUserIds.length);
  return {
    status: 'pending',
    outcome: 'pending',
    totalEligible,
    votedCount: votedUserIds.length,
    pendingCount,
  };
};
