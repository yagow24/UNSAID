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

const POLLS_COLLECTION = 'problemPolls';
const RESPONSES_COLLECTION = 'problemPollResponses';

/**
 * Subscribes to the active community poll for a specific problem in real-time.
 * Each problem has at most one primary active community poll.
 */
export const subscribeToProblemPoll = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate(null);
    return () => {};
  }

  if (!db) {
    if (onUpdate) onUpdate(null);
    return () => {};
  }

  try {
    const pollDocRef = doc(db, POLLS_COLLECTION, problemId);
    const unsubscribe = onSnapshot(
      pollDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate({ id: snapshot.id, ...snapshot.data() });
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.warn('[UNSAID Poll] Poll subscription error:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Poll] Failed to set up poll listener:', err);
    return () => {};
  }
};

/**
 * Subscribes to all votes/responses for a problem poll in real-time.
 * Computes exact counts and percentages dynamically from real Firestore records.
 */
export const subscribeToPollResponses = (problemId, onUpdate, onError) => {
  if (!problemId) {
    if (onUpdate) onUpdate({ responses: [], counts: {}, percentages: {}, totalVotes: 0 });
    return () => {};
  }

  if (!db) {
    if (onUpdate) onUpdate({ responses: [], counts: {}, percentages: {}, totalVotes: 0 });
    return () => {};
  }

  try {
    const responsesRef = collection(db, RESPONSES_COLLECTION);
    const q = query(responsesRef, where('problemId', '==', problemId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const responses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const totalVotes = responses.length;

        // Tally votes per option
        const counts = {};
        for (const resp of responses) {
          if (resp.selectedOption) {
            counts[resp.selectedOption] = (counts[resp.selectedOption] || 0) + 1;
          }
        }

        // Compute exact mathematical percentages
        const percentages = {};
        for (const [option, count] of Object.entries(counts)) {
          percentages[option] = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        }

        if (onUpdate) {
          onUpdate({ responses, counts, percentages, totalVotes });
        }
      },
      (err) => {
        console.warn('[UNSAID Poll] Poll responses subscription error:', err);
        if (onError) onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[UNSAID Poll] Failed to set up poll responses listener:', err);
    return () => {};
  }
};

/**
 * Creates or updates a community poll for a problem.
 * Authorized for administrators or authorized workspace staff.
 */
export const createProblemPoll = async ({
  problemId,
  workspaceId,
  question,
  options = ['Yes', 'No'],
  currentUser,
  userProfile,
}) => {
  if (!problemId || !workspaceId) {
    throw new Error('Problem ID and Workspace ID are required to create a poll.');
  }
  if (!question || !question.trim()) {
    throw new Error('Please provide a poll question.');
  }
  if (!currentUser?.uid) {
    throw new Error('User must be authenticated to create a poll.');
  }

  const trimmedQuestion = question.trim();
  const cleanedOptions = options
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter(Boolean);

  if (cleanedOptions.length < 2) {
    throw new Error('A poll requires at least 2 distinct options.');
  }

  const pollDocRef = doc(db, POLLS_COLLECTION, problemId);
  const pollData = {
    problemId,
    workspaceId,
    question: trimmedQuestion,
    options: cleanedOptions,
    status: 'active', // 'active' | 'closed'
    createdBy: currentUser.uid,
    createdByName: userProfile?.fullName || currentUser.displayName || 'Administrator',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(pollDocRef, pollData);
  return { id: problemId, ...pollData };
};

/**
 * Submits a vote on a community poll.
 * Uses deterministic document ID `${problemId}_${userId}` to guarantee 1 vote per user.
 * Voting again updates the user's vote rather than creating duplicate records.
 */
export const submitPollVote = async ({
  problemId,
  workspaceId,
  selectedOption,
  currentUser,
  userProfile,
}) => {
  if (!problemId || !workspaceId || !selectedOption) {
    throw new Error('Problem, workspace, and selected option are required to vote.');
  }
  if (!currentUser?.uid) {
    throw new Error('You must be signed in to vote on this poll.');
  }

  // Verify poll status is active
  const pollDocRef = doc(db, POLLS_COLLECTION, problemId);
  const pollSnap = await getDoc(pollDocRef);
  if (!pollSnap.exists()) {
    throw new Error('This poll does not exist or has been removed.');
  }
  const pollData = pollSnap.data();
  if (pollData.status === 'closed') {
    throw new Error('This poll has been closed. Further voting is not permitted.');
  }

  const responseDocId = `${problemId}_${currentUser.uid}`;
  const responseDocRef = doc(db, RESPONSES_COLLECTION, responseDocId);

  const responseData = {
    pollId: problemId,
    problemId,
    workspaceId,
    userId: currentUser.uid,
    userName: userProfile?.fullName || currentUser.displayName || 'Member',
    selectedOption: selectedOption.trim(),
    updatedAt: serverTimestamp(),
  };

  // Check if this is an initial vote or an update to preserve createdAt
  const existingSnap = await getDoc(responseDocRef);
  if (!existingSnap.exists()) {
    responseData.createdAt = serverTimestamp();
  }

  await setDoc(responseDocRef, responseData, { merge: true });
  return { id: responseDocId, ...responseData };
};

/**
 * Closes an active poll so further voting is prohibited while results remain visible.
 */
export const closeProblemPoll = async (problemId) => {
  if (!problemId || !db) return;
  const pollDocRef = doc(db, POLLS_COLLECTION, problemId);
  await updateDoc(pollDocRef, {
    status: 'closed',
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Re-opens a closed poll for further voting.
 */
export const reopenProblemPoll = async (problemId) => {
  if (!problemId || !db) return;
  const pollDocRef = doc(db, POLLS_COLLECTION, problemId);
  await updateDoc(pollDocRef, {
    status: 'active',
    reopenedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};
