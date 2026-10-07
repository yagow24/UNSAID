import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  ThumbsUp,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  BarChart3,
  Activity,
  Send,
  ShieldCheck,
  Link2,
  Flag,
  HelpCircle,
  TrendingUp,
  Check,
  ChevronDown,
  ChevronUp,
  Award,
  Lock,
  Lightbulb,
  Trash2,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CommunityPollWidget } from '../poll/CommunityPollWidget';
import { useAuth } from '../../hooks/useAuth';
import { useIdentity } from '../../hooks/useIdentity';
import { buildProblemActivityTimeline } from '../../utils/activityTimeline';
import { subscribeToProblemPoll } from '../../services/pollService';
import {
  updateProblemStatus,
  subscribeToProblemMessages,
  sendProblemMessage,
  dismissProblemMessage,
  broadcastOfficialResolution,
  subscribeToProblemAcknowledgements,
  toggleProblemAcknowledgement,
  subscribeToEscalationVotes,
  submitEscalationVote,
  subscribeToProblemFeedback,
  submitQualityFeedback,
  markProblemRecurring,
  markProblemThreadRead,
  deleteProblem,
} from '../../services/problemService';

export const ProblemDetailsModal = ({
  isOpen,
  onClose,
  problem: initialProblem,
  workspace,
  allWorkspaceProblems = [],
  onStatusChanged,
  onProblemUpdated,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { isAnonymous, pseudonym } = useIdentity();

  // Local sync of problem state
  const [prevInitialProblem, setPrevInitialProblem] = useState(initialProblem);
  const [localProblem, setLocalProblem] = useState(initialProblem);

  if (prevInitialProblem !== initialProblem) {
    setPrevInitialProblem(initialProblem);
    setLocalProblem(initialProblem);
  }

  const problem = localProblem || initialProblem;
  const setProblem = setLocalProblem;

  const [updatingStatus, setUpdatingStatus] = useState(false);

  // 1. Two-Way Messaging State
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [revealedDismissedIds, setRevealedDismissedIds] = useState(new Set());
  const messagesEndRef = useRef(null);

  // 2. Real-time Collections State
  const [poll, setPoll] = useState(null);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [escalationVotes, setEscalationVotes] = useState([]);
  const [qualityFeedbacks, setQualityFeedbacks] = useState([]);
  const [activeTab, setActiveTab] = useState('discussion'); // 'discussion' | 'poll' | 'activity'

  // 3. Official Resolution Form State (Admin)
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionActionTaken, setResolutionActionTaken] = useState('');
  const [broadcastingResolution, setBroadcastingResolution] = useState(false);

  // 4. Recurrence Linking State
  const [showRecurrenceForm, setShowRecurrenceForm] = useState(false);
  const [selectedLinkProblemId, setSelectedLinkProblemId] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(2);
  const [linkingRecurrence, setLinkingRecurrence] = useState(false);

  // 5. Delete Query State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingProblem, setDeletingProblem] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Real-time Firestore Subscriptions for this problem
  useEffect(() => {
    if (!isOpen || !problem?.id) return;

    const unsubMessages = subscribeToProblemMessages(
      problem.id,
      (list) => setMessages(list),
      (err) => console.warn('[UNSAID Problem Details] Message sync notice:', err)
    );

    const unsubPoll = subscribeToProblemPoll(
      problem.id,
      (p) => setPoll(p),
      (err) => console.warn('[UNSAID Problem Details] Poll sync notice:', err)
    );

    const unsubAcks = subscribeToProblemAcknowledgements(
      problem.id,
      (list) => setAcknowledgements(list),
      (err) => console.warn('[UNSAID Problem Details] Acks sync notice:', err)
    );

    const unsubVotes = subscribeToEscalationVotes(
      problem.id,
      (list) => setEscalationVotes(list),
      (err) => console.warn('[UNSAID Problem Details] Escalation sync notice:', err)
    );

    const unsubFeedback = subscribeToProblemFeedback(
      problem.id,
      (list) => setQualityFeedbacks(list),
      (err) => console.warn('[UNSAID Problem Details] Feedback sync notice:', err)
    );

    // Mark thread as read for the active viewer
    const viewerRole = userProfile?.role === 'admin' ? 'admin' : 'member';
    markProblemThreadRead(problem.id, viewerRole);

    return () => {
      unsubMessages();
      unsubPoll();
      unsubAcks();
      unsubVotes();
      unsubFeedback();
    };
  }, [isOpen, problem?.id, userProfile?.role]);

  // Scroll to bottom of message thread on new message
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const activityTimeline = useMemo(() => {
    if (!problem) return [];
    return buildProblemActivityTimeline({
      problem,
      messages,
      poll,
      acknowledgements,
      escalationVotes,
      qualityFeedbacks,
    });
  }, [problem, messages, poll, acknowledgements, escalationVotes, qualityFeedbacks]);

  if (!problem) return null;

  const isEmergency = problem.isEmergency || problem.priority === 'emergency';
  const isSolved = problem.status === 'solved' || problem.status === 'resolved';

  const isAuthor =
    currentUser?.uid &&
    (problem.authorId === currentUser.uid ||
      problem.createdBy === currentUser.uid ||
      (problem.authorEmail && currentUser.email && problem.authorEmail === currentUser.email));

  const isAdmin =
    userProfile?.role === 'admin' ||
    workspace?.createdBy === currentUser?.uid;

  const handleDeleteProblem = async () => {
    if (!problem?.id) return;
    setDeletingProblem(true);
    setDeleteError('');
    try {
      await deleteProblem(problem.id, workspace?.id || problem.workspaceId);
      setShowDeleteConfirm(false);
      if (onStatusChanged) onStatusChanged(problem.id, 'deleted');
      if (onClose) onClose();
    } catch (err) {
      console.error('[UNSAID Delete Problem Error]', err);
      setDeleteError(err.message || 'Failed to delete query.');
    } finally {
      setDeletingProblem(false);
    }
  };

  // Format Helper
  const formatTimestamp = (ts) => {
    if (!ts) return 'Unknown';
    const date =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : typeof ts === 'string' || typeof ts === 'number'
        ? new Date(ts)
        : null;
    if (!date) return 'Recently';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Toggle problem status
  const handleToggleStatus = async () => {
    setUpdatingStatus(true);
    try {
      const nextStatus = isSolved ? 'open' : 'solved';
      await updateProblemStatus(problem.id, nextStatus, workspace?.id || problem.workspaceId);
      const updated = { ...problem, status: nextStatus };
      setProblem(updated);
      if (onStatusChanged) onStatusChanged(problem.id, nextStatus);
      if (onProblemUpdated) onProblemUpdated(updated);
    } catch (err) {
      console.error('[UNSAID Problem Details] Status update failed:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // 1. Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const trimmed = newMessageText.trim();
    if (!trimmed || sendingMessage) return;

    setSendingMessage(true);
    try {
      await sendProblemMessage({
        problemId: problem.id,
        workspaceId: workspace?.id || problem.workspaceId,
        message: trimmed,
        currentUser,
        userProfile,
        isAnonymous,
        pseudonym,
        isOfficial: isAdmin,
      });
      setNewMessageText('');
    } catch (err) {
      console.error('[UNSAID Send Message Error]', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyDownComposer = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 1b. Dismiss / Flag unhelpful comment
  const handleDismissMessage = async (messageId) => {
    if (!currentUser?.uid) return;
    try {
      await dismissProblemMessage({
        messageId,
        dismissedByUserId: currentUser.uid,
        problemId: problem.id,
      });
    } catch (err) {
      console.error('[UNSAID Dismiss Message Error]', err);
    }
  };

  const toggleRevealDismissed = (id) => {
    setRevealedDismissedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  // 2. Broadcast Official Resolution
  const handleBroadcastResolution = async (e) => {
    e.preventDefault();
    if (!resolutionText.trim()) return;

    setBroadcastingResolution(true);
    try {
      const resolution = await broadcastOfficialResolution({
        problemId: problem.id,
        workspaceId: workspace?.id || problem.workspaceId,
        resolutionText: resolutionText.trim(),
        actionTaken: resolutionActionTaken,
        adminUser: currentUser,
        adminProfile: userProfile,
      });
      const updated = {
        ...problem,
        status: 'solved',
        officialResolution: resolution,
      };
      setProblem(updated);
      setShowResolutionForm(false);
      setResolutionText('');
      setResolutionActionTaken('');
      if (onStatusChanged) onStatusChanged(problem.id, 'solved');
      if (onProblemUpdated) onProblemUpdated(updated);
    } catch (err) {
      console.error('[UNSAID Broadcast Resolution Error]', err);
    } finally {
      setBroadcastingResolution(false);
    }
  };

  // 3. Dynamic Acknowledgement Calculations
  const ackCount = acknowledgements.length;
  const eligibleMembers = Math.max(1, workspace?.memberCount || workspace?.membersCount || 40);
  const ackThreshold = Number(workspace?.acknowledgementThreshold) || 65;
  const ackPercentage = eligibleMembers > 0 ? Math.round((ackCount / eligibleMembers) * 100) : 0;
  const hasUserAcked = currentUser?.uid
    ? acknowledgements.some((a) => a.userId === currentUser.uid)
    : false;

  const handleToggleAcknowledgement = async () => {
    if (!currentUser?.uid) return;
    try {
      const result = await toggleProblemAcknowledgement({
        problemId: problem.id,
        workspaceId: workspace?.id || problem.workspaceId,
        userId: currentUser.uid,
        eligibleMemberCount: eligibleMembers,
        thresholdPercentage: ackThreshold,
      });
      if (result) {
        const updated = {
          ...problem,
          acknowledgementsCount: result.ackCount,
          acknowledgementReached: result.isThresholdReached,
          isArchivedFromFeed: result.isThresholdReached,
        };
        setProblem(updated);
        if (onProblemUpdated) onProblemUpdated(updated);
      }
    } catch (err) {
      console.error('[UNSAID Toggle Acknowledgement Error]', err);
    }
  };

  // 4. Community Escalation Poll Calculations
  const yesVotes = escalationVotes.filter((v) => v.vote === 'yes');
  const noVotes = escalationVotes.filter((v) => v.vote === 'no');
  const totalVotes = yesVotes.length + noVotes.length;
  const yesPercentage = totalVotes > 0 ? Math.round((yesVotes.length / totalVotes) * 100) : 0;
  const noPercentage = totalVotes > 0 ? Math.round((noVotes.length / totalVotes) * 100) : 0;
  const userVote = currentUser?.uid
    ? escalationVotes.find((v) => v.userId === currentUser.uid)?.vote || null
    : null;

  const handleVoteEscalation = async (voteType) => {
    if (!currentUser?.uid) return;
    try {
      await submitEscalationVote({
        problemId: problem.id,
        workspaceId: workspace?.id || problem.workspaceId,
        userId: currentUser.uid,
        vote: voteType,
      });
    } catch (err) {
      console.error('[UNSAID Vote Escalation Error]', err);
    }
  };

  // 5. Quality Feedback Post-Resolution
  const userFeedback = currentUser?.uid
    ? qualityFeedbacks.find((f) => f.userId === currentUser.uid)?.feedback || null
    : null;
  const solvedCount = qualityFeedbacks.filter((f) => f.feedback === 'solved').length;
  const partiallySolvedCount = qualityFeedbacks.filter((f) => f.feedback === 'partially_solved').length;
  const stillConfusedCount = qualityFeedbacks.filter((f) => f.feedback === 'still_confused').length;

  const handleQualityFeedback = async (rating) => {
    if (!currentUser?.uid) return;
    try {
      await submitQualityFeedback({
        problemId: problem.id,
        workspaceId: workspace?.id || problem.workspaceId,
        userId: currentUser.uid,
        feedback: rating,
      });
    } catch (err) {
      console.error('[UNSAID Quality Feedback Error]', err);
    }
  };

  // 6. Recurrence Linking
  const otherProblems = allWorkspaceProblems.filter((p) => p.id !== problem.id);

  const handleLinkRecurrence = async (e) => {
    e.preventDefault();
    if (!selectedLinkProblemId) return;

    const linkedTarget = otherProblems.find((p) => p.id === selectedLinkProblemId);
    setLinkingRecurrence(true);
    try {
      const rec = await markProblemRecurring({
        problemId: problem.id,
        recurrenceOf: selectedLinkProblemId,
        linkedProblemTitle: linkedTarget?.title || 'Prior Problem Incident',
        recurrenceCount: recurrenceCount,
        workspaceId: workspace?.id || problem.workspaceId,
      });
      const updated = {
        ...problem,
        isRecurring: true,
        recurrenceOf: rec.recurrenceOf,
        linkedProblemId: rec.recurrenceOf,
        linkedProblemTitle: rec.linkedProblemTitle,
        recurrenceCount: rec.recurrenceCount,
      };
      setProblem(updated);
      setShowRecurrenceForm(false);
      if (onProblemUpdated) onProblemUpdated(updated);
    } catch (err) {
      console.error('[UNSAID Mark Recurrence Error]', err);
    } finally {
      setLinkingRecurrence(false);
    }
  };

  const officialRes = problem.officialResolution;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span>Query Triage & Discussion</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--glass-border)]">
            #{problem.id.length > 8 ? problem.id.slice(-6).toUpperCase() : problem.id}
          </span>
          {problem.isRecurring && (
            <Badge variant="cyan" size="sm" icon={<RotateCcw className="w-3 h-3" />}>
              Recurring (#{problem.recurrenceCount || problem.recurringCount || 2})
            </Badge>
          )}
        </div>
      }
      subtitle={`Workspace discussion for "${workspace?.name || 'Workspace'}"`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {(isAdmin || isAuthor) && (
              <Button
                variant={isSolved ? 'secondary' : 'primary'}
                size="sm"
                isLoading={updatingStatus}
                icon={isSolved ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                onClick={handleToggleStatus}
              >
                {isSolved ? 'Reopen Query' : 'Mark as Solved'}
              </Button>
            )}
            {(isAdmin || isAuthor) && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  setDeleteError('');
                  setShowDeleteConfirm(true);
                }}
              >
                Delete Query
              </Button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-1 max-h-[75vh] overflow-y-auto pr-1">
        {/* ========================================================= */}
        {/* OFFICIAL RESOLUTION BROADCAST BANNER                      */}
        {/* ========================================================= */}
        {officialRes && (
          <div className="p-4 rounded-2xl bg-[var(--success-light)]/20 border-2 border-[var(--success)]/60 text-[var(--text)] space-y-2 shadow-sm ring-1 ring-[var(--success)]/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="low" size="sm" icon={<Award className="w-3.5 h-3.5" />}>
                  OFFICIAL RESOLUTION
                </Badge>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimestamp(officialRes.resolvedAt)}
              </span>
            </div>

            <div className="text-sm font-semibold text-[var(--text)]">
              {officialRes.resolutionText || officialRes.summary}
            </div>

            {officialRes.actionTaken && (
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--glass-border)]">
                <strong className="text-[var(--text)] block text-[11px] mb-0.5">Action Taken:</strong>
                {officialRes.actionTaken}
              </p>
            )}

            <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--success)]" />
              <span>Resolved by:</span>
              <strong className="text-[var(--text)]">
                {officialRes.resolvedByName || officialRes.resolvedBy || 'Workspace Administrator'}
              </strong>
            </div>
          </div>
        )}

        {/* Admin Broadcast Button / Form */}
        {isAdmin && (
          <div className="space-y-2">
            {!showResolutionForm ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Award className="w-3.5 h-3.5 text-[var(--success)]" />}
                onClick={() => setShowResolutionForm(true)}
              >
                {officialRes ? 'Update Official Resolution' : 'Publish Official Resolution'}
              </Button>
            ) : (
              <form
                onSubmit={handleBroadcastResolution}
                className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[var(--success)]" />
                    Publish Official Resolution
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowResolutionForm(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                    Resolution Text <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    placeholder="e.g. Swapped network switch on floor 3. Connectivity restored."
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                    Action Taken / Member Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionActionTaken}
                    onChange={(e) => setResolutionActionTaken(e.target.value)}
                    placeholder="e.g. Please reboot your workstation network adapter if you experience lag."
                    className="w-full px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={broadcastingResolution}
                    disabled={broadcastingResolution}
                    icon={<Award className="w-3.5 h-3.5" />}
                  >
                    Publish Official Resolution
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* META HEADER GRID                                          */}
        {/* ========================================================= */}
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Priority
            </span>
            <div className="mt-1">
              {isEmergency ? (
                <Badge variant="high" size="sm" dot>
                  EMERGENCY
                </Badge>
              ) : (
                <Badge variant="medium" size="sm">
                  Normal
                </Badge>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Status
            </span>
            <div className="mt-1">
              {isSolved ? (
                <Badge variant="low" size="sm" dot>
                  SOLVED
                </Badge>
              ) : (
                <Badge variant="warning" size="sm" dot>
                  OPEN
                </Badge>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Category
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              <Badge variant="cyan" size="sm">
                {problem.category || 'General'}
              </Badge>
              {problem.subIssue && (
                <Badge variant="neutral" size="sm">
                  {problem.subIssue}
                </Badge>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block">
              Community Votes
            </span>
            <div className="mt-1 flex items-center gap-1 font-bold text-[var(--primary)]">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>{problem.upvotesCount || problem.upvotedBy?.length || 0}</span>
            </div>
          </div>
        </div>

        {/* Confidential 1-on-1 Direct Thread Banner */}
        {problem.isConfidential && (
          <div className="p-3.5 rounded-2xl bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--text)]">Confidential 1-on-1 Direct Thread</span>
                <Badge variant="primary" size="xs">Admin & Staff Only</Badge>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                This query is strictly confidential. Only you and authorized workspace administrators can view this thread and reply to it. It never appears in public workspace feeds.
              </div>
            </div>
          </div>
        )}

        {/* Title, Description & Workaround */}
        <div className="space-y-2">
          <h3 className="text-base font-bold text-[var(--text)] tracking-tight">
            {problem.title || 'Untitled Query'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {problem.description}
          </p>

          {problem.workaround && !problem.aiAnalysis && (
            <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs space-y-1">
              <span className="font-semibold text-[var(--text)] block text-[11px]">
                💡 Proposed Workaround:
              </span>
              <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                {problem.workaround}
              </p>
            </div>
          )}

          {problem.aiAnalysis && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--cyan)]/25 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text)] flex items-center gap-1.5 text-[11px]">
                  <Lightbulb className="w-3.5 h-3.5 text-[var(--cyan)]" />
                  AI Suggested Resolution Attempt:
                </span>
                {problem.aiAnalysis.escalatedFromAI && (
                  <Badge variant="high" size="xs">
                    Unresolved by AI
                  </Badge>
                )}
              </div>
              {problem.aiAnalysis.suggestedWorkaround && (
                <p className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
                  {problem.aiAnalysis.suggestedWorkaround}
                </p>
              )}
              {problem.aiAnalysis.userFeedback && (
                <div className="text-[10px] text-[var(--text-muted)] italic">
                  User feedback: "{problem.aiAnalysis.userFeedback}"
                </div>
              )}
            </div>
          )}

          {problem.imageUrl && (
            <div className="pt-2">
              <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] block mb-1">
                Visual Evidence
              </span>
              <img
                src={problem.imageUrl}
                alt={problem.title || 'Attached evidence'}
                className="max-h-60 rounded-xl object-cover border border-[var(--glass-border)]"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RECURRENCE SECTION                                        */}
        {/* ========================================================= */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[var(--cyan)]" />
              Recurrence Tracking
            </span>
            {problem.isRecurring ? (
              <Badge variant="cyan" size="sm">
                Recurrence #{problem.recurrenceCount || problem.recurringCount || 2}
              </Badge>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowRecurrenceForm(!showRecurrenceForm)}
                className="text-[11px] h-7"
              >
                Mark as Recurring
              </Button>
            )}
          </div>

          {problem.isRecurring && (
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 bg-[var(--surface-hover)] p-2.5 rounded-xl border border-[var(--glass-border)]">
              <Link2 className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0" />
              <span>Linked from previous issue:</span>
              <strong className="text-[var(--text)] truncate">
                {problem.linkedProblemTitle || 'Previous Incident'}
              </strong>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                (#{problem.recurrenceOf?.slice(-6).toUpperCase() || problem.linkedProblemId?.slice(-6).toUpperCase()})
              </span>
            </div>
          )}

          {showRecurrenceForm && !problem.isRecurring && (
            <form onSubmit={handleLinkRecurrence} className="space-y-3 pt-1 border-t border-[var(--glass-border)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block">
                    Link to Previous Problem
                  </label>
                  <select
                    value={selectedLinkProblemId}
                    onChange={(e) => setSelectedLinkProblemId(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none"
                  >
                    <option value="">Select past problem...</option>
                    {otherProblems.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (#{p.id.slice(-6).toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[var(--text-muted)] uppercase block">
                    Occurrence #
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRecurrenceForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={linkingRecurrence}
                  disabled={linkingRecurrence || !selectedLinkProblemId}
                >
                  Confirm Link
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* ========================================================= */}
        {/* DYNAMIC ACKNOWLEDGEMENT & ESCALATION ROW                  */}
        {/* ========================================================= */}
        {!problem.isConfidential && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dynamic Acknowledgement */}
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                  Dynamic Acknowledgement
                </span>
                <span className="text-xs font-bold font-mono text-[var(--text)]">
                  {ackCount} / {eligibleMembers} ({ackPercentage}%)
                </span>
              </div>

              {/* Meter Progress Bar */}
              <div className="space-y-1">
                <div className="relative w-full h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden border border-[var(--glass-border)]">
                  <div
                    className={`h-full transition-all duration-500 ${
                      ackPercentage >= ackThreshold
                        ? 'bg-[var(--success)]'
                        : 'bg-[var(--primary)]'
                    }`}
                    style={{ width: `${Math.min(100, ackPercentage)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>0%</span>
                  <span className="text-[var(--cyan)] font-semibold">
                    Threshold: {ackThreshold}%
                  </span>
                  <span>100%</span>
                </div>
              </div>

              {ackPercentage >= ackThreshold ? (
                <div className="p-2 rounded-xl bg-[var(--success-light)]/20 border border-[var(--success)]/40 text-[var(--success)] text-[11px] font-semibold text-center">
                  Threshold reached ({ackPercentage}%). Removed from active feed & archived to history.
                </div>
              ) : (
                <Button
                  type="button"
                  variant={hasUserAcked ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={handleToggleAcknowledgement}
                  icon={<Check className="w-3.5 h-3.5" />}
                  className="w-full text-xs"
                >
                  {hasUserAcked ? 'You Confirmed Resolution' : 'Resolved for Me'}
                </Button>
              )}
            </div>

            {/* Community Escalation Poll */}
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--danger)]" />
                  Community Escalation
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {totalVotes === 0 ? 'No votes yet' : `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`}
                </span>
              </div>

              <p className="text-[11px] text-[var(--text-muted)]">
                Should this issue be escalated to leadership for immediate intervention?
              </p>

              {/* Percentage Meters */}
              {totalVotes === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)] italic py-1">No votes yet</p>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[var(--danger)]">
                      Yes ({yesPercentage}%)
                    </span>
                    <span className="text-[var(--text-muted)]">
                      No ({noPercentage}%)
                    </span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden border border-[var(--glass-border)] bg-[var(--surface-hover)]">
                    <div
                      className="bg-[var(--danger)] transition-all duration-300"
                      style={{ width: `${yesPercentage}%` }}
                    />
                    <div
                      className="bg-[var(--glass-border)] transition-all duration-300"
                      style={{ width: `${noPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Vote Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleVoteEscalation('yes')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    userVote === 'yes'
                      ? 'bg-[var(--danger)] text-white border-[var(--danger)] shadow-xs'
                      : 'bg-[var(--surface-hover)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text)]'
                  }`}
                >
                  Yes ({yesVotes.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleVoteEscalation('no')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    userVote === 'no'
                      ? 'bg-[var(--surface-hover)] border-[var(--text)] text-[var(--text)] font-bold'
                      : 'bg-[var(--surface-hover)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-muted)]'
                  }`}
                >
                  No ({noVotes.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* QUALITY FEEDBACK SECTION (WHEN RESOLVED / SOLVED)         */}
        {/* ========================================================= */}
        {isSolved && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[var(--cyan)]" />
                Resolution Quality Feedback
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                🟢 {solvedCount} · 🟡 {partiallySolvedCount} · 🔴 {stillConfusedCount}
              </span>
            </div>

            {userFeedback && (
              <p className="text-[11px] text-[var(--text)] font-medium">
                Your feedback:{' '}
                <strong className="text-[var(--cyan)]">
                  {userFeedback === 'solved'
                    ? '✓ Solved'
                    : userFeedback === 'partially_solved'
                    ? 'Partially Solved'
                    : 'Still Confused'}
                </strong>
              </p>
            )}

            <p className="text-[11px] text-[var(--text-muted)]">
              How effective was the outcome for you?
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQualityFeedback('solved')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  userFeedback === 'solved'
                    ? 'bg-[var(--success-light)] border-[var(--success)] text-[var(--success)] shadow-xs font-bold'
                    : 'bg-[var(--surface-hover)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text)]'
                }`}
              >
                🟢 Solved
              </button>
              <button
                type="button"
                onClick={() => handleQualityFeedback('partially_solved')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  userFeedback === 'partially_solved'
                    ? 'bg-[var(--warning-light)] border-[var(--warning)] text-[var(--warning)] shadow-xs font-bold'
                    : 'bg-[var(--surface-hover)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text)]'
                }`}
              >
                🟡 Partially Solved
              </button>
              <button
                type="button"
                onClick={() => handleQualityFeedback('still_confused')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  userFeedback === 'still_confused'
                    ? 'bg-[var(--danger-light)] border-[var(--danger)] text-[var(--danger)] shadow-xs font-bold'
                    : 'bg-[var(--surface-hover)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text)]'
                }`}
              >
                🔴 Still Confused
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* INTERACTIVE TABS: [ Discussion ] [ Poll ] [ Activity ]    */}
        {/* ========================================================= */}
        <div className="border-b border-[var(--glass-border)] flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('discussion')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'discussion'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discussion</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--surface-hover)] border border-[var(--glass-border)]">
              {messages.length}
            </span>
          </button>

          {!problem.isConfidential && (
            <button
              type="button"
              onClick={() => setActiveTab('poll')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'poll'
                  ? 'border-[var(--cyan)] text-[var(--cyan)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Community Poll</span>
              {poll && <span className="w-2 h-2 rounded-full bg-[var(--cyan)] animate-pulse" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'activity'
                ? 'border-[var(--success)] text-[var(--success)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity Timeline</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--surface-hover)] border border-[var(--glass-border)]">
              {activityTimeline.length}
            </span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB CONTENT 1: DISCUSSION THREAD                          */}
        {/* ========================================================= */}
        {activeTab === 'discussion' && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                {problem.isConfidential ? (
                  <Lock className="w-3.5 h-3.5 text-[var(--primary)]" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--primary)]" />
                )}
                {problem.isConfidential
                  ? 'Confidential 1-on-1 Direct Conversation'
                  : 'Two-Way Conversation Thread'}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
            </div>

            {/* Messages Container */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-1">
                  {problem.isConfidential ? (
                    <Lock className="w-6 h-6 mx-auto opacity-40 text-[var(--primary)]" />
                  ) : (
                    <MessageSquare className="w-6 h-6 mx-auto opacity-40" />
                  )}
                  <p>No messages in this thread yet.</p>
                  <p className="text-[10px]">
                    {problem.isConfidential
                      ? 'Messages sent here are strictly confidential between you and authorized admins.'
                      : 'Staff and members can communicate here in real-time.'}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMsgAuthor = msg.senderId === currentUser?.uid || msg.authorId === currentUser?.uid;
                  const canModerate = isAuthor || isAdmin;
                  const isOfficial = Boolean(msg.isOfficial || msg.isStaffResponse);
                  const isDismissed = msg.isDismissed;
                  const isRevealed = revealedDismissedIds.has(msg.id);

                  if (isDismissed && !isRevealed) {
                    return (
                      <div
                        key={msg.id}
                        className="p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text-muted)] flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5 italic text-[11px]">
                          <Flag className="w-3 h-3 text-[var(--text-muted)]" />
                          This comment was dismissed.
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRevealDismissed(msg.id)}
                          className="text-[11px] font-semibold text-[var(--cyan)] hover:underline cursor-pointer flex items-center gap-0.5"
                        >
                          Show <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl text-xs space-y-1.5 border transition-all ${
                        isOfficial
                          ? 'bg-gradient-to-r from-[var(--primary)]/15 via-[#8b5cf6]/10 to-[var(--cyan)]/10 border-[var(--primary)]/50 shadow-sm ring-1 ring-[var(--primary)]/30'
                          : isMsgAuthor
                          ? 'bg-[var(--surface-hover)] border-[var(--glass-border)]'
                          : 'bg-[var(--surface)] border-[var(--glass-border)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <strong
                            className={`font-semibold ${
                              isOfficial
                                ? 'text-[var(--primary)]'
                                : msg.isAnonymous
                                ? 'text-[var(--cyan)] font-mono'
                                : 'text-[var(--text)]'
                            }`}
                          >
                            {msg.senderName || msg.authorName || 'Workspace Member'}
                          </strong>

                          {isOfficial && (
                            <Badge variant="high" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
                              OFFICIAL
                            </Badge>
                          )}

                          {msg.isAnonymous && (
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              (Anon)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {msg.isOfflineQueued && (
                            <span className="text-[10px] text-[var(--warning)] font-medium">
                              🕒 Queued offline
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {formatTimestamp(msg.createdAt)}
                          </span>

                          {canModerate && !msg.isDismissed && (
                            <button
                              type="button"
                              onClick={() => handleDismissMessage(msg.id)}
                              title="Mark comment as unhelpful"
                              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer"
                            >
                              <Flag className="w-3 h-3" />
                            </button>
                          )}

                          {isDismissed && isRevealed && (
                            <button
                              type="button"
                              onClick={() => toggleRevealDismissed(msg.id)}
                              title="Hide unhelpful comment"
                              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                        {msg.message || msg.text}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* New Message Input Form */}
            <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-[var(--glass-border)]">
              <textarea
                rows={1}
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                onKeyDown={handleKeyDownComposer}
                placeholder={
                  isAdmin
                    ? 'Send official response as Staff / Admin (Enter to send)...'
                    : isAnonymous
                    ? `Reply as ${pseudonym} (Enter to send)...`
                    : 'Add to conversation thread (Enter to send, Shift+Enter for newline)...'
                }
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={sendingMessage}
                disabled={sendingMessage || !newMessageText.trim()}
                icon={<Send className="w-3.5 h-3.5" />}
              >
                Send
              </Button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB CONTENT 2: COMMUNITY POLL                             */}
        {/* ========================================================= */}
        {activeTab === 'poll' && !problem.isConfidential && (
          <div className="pt-1">
            <CommunityPollWidget
              problemId={problem.id}
              workspaceId={problem.workspaceId}
              currentUser={currentUser}
              userProfile={userProfile}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB CONTENT 3: ACTIVITY TIMELINE                          */}
        {/* ========================================================= */}
        {activeTab === 'activity' && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Resolution Audit & Activity History</span>
              <span className="font-mono">{activityTimeline.length} events</span>
            </div>

            {activityTimeline.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-1">
                <Activity className="w-6 h-6 mx-auto opacity-40 text-[var(--text-muted)]" />
                <p>No activity records for this query yet.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-[var(--glass-border)]">
                {activityTimeline.map((evt) => (
                  <div key={evt.id} className="relative space-y-1 text-xs">
                    <div
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-[var(--surface)] ${
                        evt.type === 'resolved' || evt.badgeVariant === 'high'
                          ? 'bg-[var(--primary)]'
                          : evt.type === 'poll_created'
                          ? 'bg-[var(--cyan)]'
                          : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-[var(--text)]">{evt.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {formatTimestamp(evt.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      {evt.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Query Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Delete Query?</h3>
                <p className="text-xs text-[var(--text-muted)]">Permanent removal from workspace</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] space-y-1">
              <p className="text-xs font-bold text-[var(--text)] line-clamp-1">{problem.title}</p>
              <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{problem.description}</p>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              If you made a mistake or want to remove this query, deleting it will permanently remove it from the workspace feed and discussions.
            </p>

            {deleteError && (
              <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 p-2.5 rounded-xl border border-[var(--danger)]/20">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deletingProblem}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deletingProblem}
                disabled={deletingProblem}
                onClick={handleDeleteProblem}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Query
              </Button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
};

