/**
 * activityTimeline.js
 * Aggregates real Firestore activity records into a unified chronological timeline.
 * STRICT: Absolutely no fake events. Only real recorded timestamps and actions.
 */

const parseTimestamp = (ts) => {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (ts instanceof Date) return ts;
  return null;
};

export const buildProblemActivityTimeline = ({
  problem,
  messages = [],
  poll = null,
  acknowledgements = [],
  escalationVotes = [],
  qualityFeedbacks = [],
}) => {
  if (!problem) return [];

  const events = [];

  // 1. Problem Created
  const createdDate = parseTimestamp(problem.createdAt);
  if (createdDate) {
    events.push({
      id: `evt_created_${problem.id}`,
      type: 'created',
      title: 'Query Submitted',
      description: `Reported by ${problem.authorName || problem.authorEmail || 'Member'}${
        problem.isAnonymous ? ' (Anonymous)' : ''
      }`,
      actorName: problem.authorName || 'Member',
      timestamp: createdDate,
      badge: problem.category || 'General',
      badgeVariant: 'cyan',
    });
  }

  // 2. Emergency Escalation (if marked)
  if (problem.isEmergency || problem.priority === 'emergency') {
    events.push({
      id: `evt_emergency_${problem.id}`,
      type: 'emergency',
      title: 'Flagged as Emergency',
      description: 'Marked for immediate priority triage and operational intervention.',
      actorName: problem.authorName || 'System',
      timestamp: createdDate || new Date(),
      badge: 'EMERGENCY',
      badgeVariant: 'high',
    });
  }

  // 3. Messages (User replies & Official replies)
  messages.forEach((msg) => {
    const msgDate = parseTimestamp(msg.createdAt);
    if (!msgDate) return;

    const isOfficial = Boolean(msg.isOfficial || msg.isStaffResponse);
    events.push({
      id: `evt_msg_${msg.id}`,
      type: isOfficial ? 'official_reply' : 'user_reply',
      title: isOfficial ? 'Official Staff Response' : 'Member Reply',
      description: msg.message || msg.text || '',
      actorName: msg.senderName || msg.authorName || (isOfficial ? 'Staff' : 'Member'),
      timestamp: msgDate,
      badge: isOfficial ? 'Official' : 'Reply',
      badgeVariant: isOfficial ? 'high' : 'neutral',
      isOfficial,
    });
  });

  // 4. Community Poll Created
  if (poll) {
    const pollDate = parseTimestamp(poll.createdAt);
    if (pollDate) {
      events.push({
        id: `evt_poll_${poll.problemId || problem.id}`,
        type: 'poll_created',
        title: 'Community Poll Opened',
        description: `Question: "${poll.question}"`,
        actorName: poll.createdByName || 'Admin',
        timestamp: pollDate,
        badge: poll.status === 'closed' ? 'Closed' : 'Active Poll',
        badgeVariant: poll.status === 'closed' ? 'neutral' : 'cyan',
      });
    }

    if (poll.status === 'closed') {
      const closedDate = parseTimestamp(poll.closedAt) || parseTimestamp(poll.updatedAt);
      if (closedDate) {
        events.push({
          id: `evt_poll_closed_${poll.problemId || problem.id}`,
          type: 'poll_closed',
          title: 'Community Poll Closed',
          description: `Poll voting finalized for: "${poll.question}"`,
          actorName: 'Admin',
          timestamp: closedDate,
          badge: 'Poll Closed',
          badgeVariant: 'neutral',
        });
      }
    }
  }

  // 5. Acknowledgements
  acknowledgements.forEach((ack) => {
    const ackDate = parseTimestamp(ack.createdAt) || parseTimestamp(ack.updatedAt);
    if (!ackDate) return;
    events.push({
      id: `evt_ack_${ack.id}`,
      type: 'acknowledgement',
      title: 'Resolution Acknowledged',
      description: `${ack.userName || 'Member'} verified the solution works for them.`,
      actorName: ack.userName || 'Member',
      timestamp: ackDate,
      badge: 'Verified',
      badgeVariant: 'low',
    });
  });

  // 6. Escalation Votes
  escalationVotes.forEach((vote) => {
    const voteDate = parseTimestamp(vote.createdAt) || parseTimestamp(vote.updatedAt);
    if (!voteDate) return;
    const isYes = vote.vote === 'yes';
    events.push({
      id: `evt_escalate_${vote.id}`,
      type: 'escalation',
      title: `Escalation Vote: ${isYes ? 'YES' : 'NO'}`,
      description: `${vote.userName || 'Member'} voted ${
        isYes ? 'to escalate this issue to leadership' : 'against escalation'
      }.`,
      actorName: vote.userName || 'Member',
      timestamp: voteDate,
      badge: isYes ? 'Escalate Yes' : 'Escalate No',
      badgeVariant: isYes ? 'high' : 'neutral',
    });
  });

  // 7. Quality Feedback
  qualityFeedbacks.forEach((fb) => {
    const fbDate = parseTimestamp(fb.createdAt) || parseTimestamp(fb.updatedAt);
    if (!fbDate) return;
    const label =
      fb.rating === 'solved'
        ? '🟢 Solved'
        : fb.rating === 'partially_solved'
        ? '🟡 Partially Solved'
        : '🔴 Still Confused';

    events.push({
      id: `evt_fb_${fb.id}`,
      type: 'feedback',
      title: 'Resolution Quality Feedback',
      description: `${fb.userName || 'Member'} submitted outcome rating: ${label}`,
      actorName: fb.userName || 'Member',
      timestamp: fbDate,
      badge: label,
      badgeVariant: fb.rating === 'solved' ? 'low' : 'warning',
    });
  });

  // 8. Official Resolution Broadcast & Solved
  if (problem.officialResolution) {
    const res = problem.officialResolution;
    const resDate = parseTimestamp(res.resolvedAt);
    if (resDate) {
      events.push({
        id: `evt_official_res_${problem.id}`,
        type: 'resolved',
        title: 'Official Resolution Published',
        description: res.resolutionText || res.summary || 'Issue officially resolved by staff.',
        actorName: res.resolvedByName || res.resolvedBy || 'Admin',
        timestamp: resDate,
        badge: 'OFFICIAL RESOLUTION',
        badgeVariant: 'high',
      });
    }
  } else if (problem.status === 'solved' || problem.status === 'resolved') {
    const solvedDate = parseTimestamp(problem.solvedAt) || parseTimestamp(problem.updatedAt);
    if (solvedDate) {
      events.push({
        id: `evt_solved_${problem.id}`,
        type: 'resolved',
        title: 'Query Marked as Solved',
        description: 'Status updated to solved by workspace administration.',
        actorName: 'Staff / Admin',
        timestamp: solvedDate,
        badge: 'SOLVED',
        badgeVariant: 'low',
      });
    }
  }

  // Sort chronological descending (latest event on top) or ascending (timeline top-to-bottom)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return events;
};
