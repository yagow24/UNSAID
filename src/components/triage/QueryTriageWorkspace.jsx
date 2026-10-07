import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  ThumbsUp,
  MessageSquare,
  BarChart3,
  Activity,
  Send,
  Award,
  Link2,
  Check,
  TrendingUp,
  Flag,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  X,
  Sparkles,
  Bot,
  Lightbulb,
  Loader2,
  Trash2,
} from 'lucide-react';

import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CommunityPollWidget } from '../poll/CommunityPollWidget';
import { AdminAISummaryModal } from './AdminAISummaryModal';
import { useAuth } from '../../hooks/useAuth';
import { useIdentity } from '../../hooks/useIdentity';
import { getShiftStatus } from '../../config/shiftConfig';
import { buildProblemActivityTimeline } from '../../utils/activityTimeline';
import { fetchAIResolution } from '../../services/aiResolutionService';

import {
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
  updateProblemStatus,
  markProblemThreadRead,
  deleteProblem,
} from '../../services/problemService';
import { subscribeToProblemPoll } from '../../services/pollService';

/**
 * Format helper for timestamps (Timestamp, ISO, Date, or millis)
 */
const formatTimeAgo = (ts) => {
  if (!ts) return 'Unknown';
  const d =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : ts.seconds
      ? new Date(ts.seconds * 1000)
      : new Date(ts);

  if (isNaN(d.getTime())) return 'Recently';

  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
};

const formatFullTime = (ts) => {
  if (!ts) return 'Unknown';
  const d =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : ts.seconds
      ? new Date(ts.seconds * 1000)
      : new Date(ts);

  if (isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const QueryTriageWorkspace = ({
  problems = [],
  loading = false,
  workspace,
  selectedProblemId: controlledSelectedId = null,
  onSelectProblem = null,
  onProblemUpdated = null,
  userMode = false,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { isAnonymous, pseudonym } = useIdentity();

  // Selected problem state
  const [internalSelectedId, setInternalSelectedId] = useState(null);
  const activeSelectedId = controlledSelectedId || internalSelectedId;

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all'); // 'all' | 'emergency' | 'high' | 'medium' | 'low'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'solved'
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Active panel tab: 'discussion' | 'poll' | 'activity'
  const [activeTab, setActiveTab] = useState('discussion');

  // Mobile detail view toggle
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Selected Problem Real-time Data
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [poll, setPoll] = useState(null);
  const [acknowledgements, setAcknowledgements] = useState([]);
  const [escalationVotes, setEscalationVotes] = useState([]);
  const [qualityFeedbacks, setQualityFeedbacks] = useState([]);

  // Local problem override for immediate optimistic updates
  const [localProblemOverride, setLocalProblemOverride] = useState(null);

  // Composer State
  const [messageInput, setMessageInput] = useState('');
  const [isOfficialToggle, setIsOfficialToggle] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [revealedDismissedIds, setRevealedDismissedIds] = useState(new Set());
  const messagesEndRef = useRef(null);

  // Quick Action Modal / Drawer States
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionActionTaken, setResolutionActionTaken] = useState('');
  const [publishingResolution, setPublishingResolution] = useState(false);

  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [linkedProblemId, setLinkedProblemId] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(2);
  const [savingRecurrence, setSavingRecurrence] = useState(false);

  // Gemini AI Triage & Summary States
  const [showAISummaryModal, setShowAISummaryModal] = useState(false);
  const [analyzingWithAI, setAnalyzingWithAI] = useState(false);
  const [aiTriageAnalysis, setAiTriageAnalysis] = useState(null);
  const [aiTriageError, setAiTriageError] = useState('');

  // Delete Query State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingQuery, setDeletingQuery] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteQuery = async () => {
    if (!selectedProblem?.id) return;
    setDeletingQuery(true);
    setDeleteError('');
    try {
      await deleteProblem(selectedProblem.id, workspace?.id || selectedProblem.workspaceId);
      setShowDeleteModal(false);
      setInternalSelectedId(null);
      if (onSelectProblem) onSelectProblem(null);
      if (onProblemUpdated) onProblemUpdated({ id: selectedProblem.id, deleted: true });
    } catch (err) {
      console.error('[UNSAID Admin Delete Query Error]', err);
      setDeleteError(err.message || 'Failed to delete query.');
    } finally {
      setDeletingQuery(false);
    }
  };

  // Role Checks
  const isAdmin =
    !userMode &&
    (userProfile?.role === 'admin' ||
      workspace?.createdBy === currentUser?.uid);

  // Derive selected problem from problems list or override
  const currentProblemFromList = useMemo(() => {
    return problems.find((p) => p.id === activeSelectedId) || null;
  }, [problems, activeSelectedId]);

  const selectedProblem = useMemo(() => {
    if (localProblemOverride && localProblemOverride.id === activeSelectedId) {
      return localProblemOverride;
    }
    return currentProblemFromList;
  }, [localProblemOverride, activeSelectedId, currentProblemFromList]);

  // Default selection if none selected on desktop
  useEffect(() => {
    if (!activeSelectedId && problems.length > 0) {
      const firstActive = problems.find((p) => p.status === 'open') || problems[0];
      if (firstActive) {
        queueMicrotask(() => {
          setInternalSelectedId(firstActive.id);
          if (onSelectProblem) onSelectProblem(firstActive);
        });
      }
    }
  }, [activeSelectedId, problems, onSelectProblem]);

  // Subscribe to real-time collections for the selected problem
  useEffect(() => {
    const probId = selectedProblem?.id;
    if (!probId) {
      queueMicrotask(() => {
        setMessages([]);
        setPoll(null);
        setAcknowledgements([]);
        setEscalationVotes([]);
        setQualityFeedbacks([]);
      });
      return;
    }

    queueMicrotask(() => {
      setLoadingMessages(true);
    });

    const unsubMessages = subscribeToProblemMessages(
      probId,
      (list) => {
        setMessages(list);
        setLoadingMessages(false);
      },
      (err) => {
        console.warn('[UNSAID Triage Messages Notice]', err);
        setLoadingMessages(false);
      }
    );

    const unsubPoll = subscribeToProblemPoll(
      probId,
      (p) => setPoll(p),
      (err) => console.warn('[UNSAID Triage Poll Notice]', err)
    );

    const unsubAcks = subscribeToProblemAcknowledgements(
      probId,
      (list) => setAcknowledgements(list),
      (err) => console.warn('[UNSAID Triage Acks Notice]', err)
    );

    const unsubVotes = subscribeToEscalationVotes(
      probId,
      (list) => setEscalationVotes(list),
      (err) => console.warn('[UNSAID Triage Escalation Notice]', err)
    );

    const unsubFeedback = subscribeToProblemFeedback(
      probId,
      (list) => setQualityFeedbacks(list),
      (err) => console.warn('[UNSAID Triage Feedback Notice]', err)
    );

    // Mark thread read
    const viewerRole = isAdmin ? 'admin' : 'member';
    markProblemThreadRead(probId, viewerRole);

    return () => {
      unsubMessages();
      unsubPoll();
      unsubAcks();
      unsubVotes();
      unsubFeedback();
    };
  }, [selectedProblem?.id, isAdmin]);

  // Scroll to bottom on messages update
  useEffect(() => {
    if (activeTab === 'discussion' && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeTab]);

  // Priority sorting score
  const getPriorityWeight = (p) => {
    const isEmerg = p.isEmergency || p.priority === 'emergency';
    if (isEmerg) return 100;
    if (p.priority === 'high') return 75;
    if (p.priority === 'medium') return 50;
    return 25; // low / normal
  };

  // Filtered & Sorted Problem List
  const filteredProblems = useMemo(() => {
    return problems
      .filter((p) => {
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (p.title || '').toLowerCase().includes(q);
          const matchDesc = (p.description || '').toLowerCase().includes(q);
          const matchAuthor = (p.authorName || '').toLowerCase().includes(q);
          const matchCategory = (p.category || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchAuthor && !matchCategory) return false;
        }

        // Priority filter
        if (priorityFilter !== 'all') {
          const isEmerg = p.isEmergency || p.priority === 'emergency';
          if (priorityFilter === 'emergency' && !isEmerg) return false;
          if (priorityFilter !== 'emergency' && (p.priority || 'medium') !== priorityFilter) return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          const isSolved = p.status === 'solved' || p.status === 'resolved';
          if (statusFilter === 'solved' && !isSolved) return false;
          if (statusFilter === 'open' && isSolved) return false;
        }

        // Category filter
        if (categoryFilter !== 'all' && p.category !== categoryFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const isSolvedA = a.status === 'solved' || a.status === 'resolved';
        const isSolvedB = b.status === 'solved' || b.status === 'resolved';

        // Solved items appear lower
        if (isSolvedA && !isSolvedB) return 1;
        if (!isSolvedA && isSolvedB) return -1;

        // Sort by Priority: Emergency -> High -> Medium -> Low
        const weightA = getPriorityWeight(a);
        const weightB = getPriorityWeight(b);
        if (weightB !== weightA) return weightB - weightA;

        // Then by latest activity/createdAt
        const timeA =
          a.updatedAt?.toMillis?.() ||
          a.createdAt?.toMillis?.() ||
          (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB =
          b.updatedAt?.toMillis?.() ||
          b.createdAt?.toMillis?.() ||
          (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
  }, [problems, searchQuery, priorityFilter, statusFilter, categoryFilter]);

  // Unique categories for filtering
  const availableCategories = useMemo(() => {
    const cats = new Set(problems.map((p) => p.category).filter(Boolean));
    return Array.from(cats);
  }, [problems]);

  // Shift status
  const shiftStatus = useMemo(() => {
    return getShiftStatus(workspace?.shiftConfig);
  }, [workspace?.shiftConfig]);

  // Activity Timeline Generator
  const activityTimeline = useMemo(() => {
    return buildProblemActivityTimeline({
      problem: selectedProblem,
      messages,
      poll,
      acknowledgements,
      escalationVotes,
      qualityFeedbacks,
    });
  }, [selectedProblem, messages, poll, acknowledgements, escalationVotes, qualityFeedbacks]);

  // Acknowledgement Metric
  const eligibleMembers = workspace?.totalMembers || workspace?.memberCount || 40;
  const ackCount = acknowledgements.length;
  const ackPercentage = Math.round((ackCount / Math.max(1, eligibleMembers)) * 100);
  const ackThreshold = workspace?.ackThreshold || 65;
  const hasUserAcked = acknowledgements.some((a) => a.userId === currentUser?.uid);

  // Escalation Metrics
  const totalEscVotes = escalationVotes.length;
  const yesVotes = escalationVotes.filter((v) => v.vote === 'yes').length;
  const yesPercentage = totalEscVotes > 0 ? Math.round((yesVotes / totalEscVotes) * 100) : 0;
  const noPercentage = totalEscVotes > 0 ? 100 - yesPercentage : 0;
  const userEscVote = escalationVotes.find((v) => v.userId === currentUser?.uid)?.vote;

  // Quality Feedback Metrics
  const userFeedback = qualityFeedbacks.find((f) => f.userId === currentUser?.uid)?.rating;

  // Handlers
  const handleSelect = (prob) => {
    setInternalSelectedId(prob.id);
    setLocalProblemOverride(null);
    setMobileDetailOpen(true);
    if (onSelectProblem) onSelectProblem(prob);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    setMessageError('');

    const trimmed = messageInput.trim();
    if (!trimmed) return;

    if (trimmed.length > 2000) {
      setMessageError('Message exceeds maximum limit of 2000 characters.');
      return;
    }

    if (!currentUser) {
      setMessageError('You must be signed in to send replies.');
      return;
    }

    if (!selectedProblem?.id || !selectedProblem?.workspaceId) {
      setMessageError('No active problem or workspace selected.');
      return;
    }

    setSendingMessage(true);
    try {
      await sendProblemMessage({
        problemId: selectedProblem.id,
        workspaceId: selectedProblem.workspaceId,
        message: trimmed,
        currentUser,
        userProfile,
        isAnonymous,
        pseudonym,
        isOfficial: isAdmin && isOfficialToggle,
        isStaff: isAdmin && isOfficialToggle,
      });

      setMessageInput('');
      setIsOfficialToggle(false);
    } catch (err) {
      console.error('[UNSAID Send Reply Error]', err);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setMessageError("You're offline. Your message could not be sent.");
      } else if (err.code === 'permission-denied') {
        setMessageError('Permission denied. You are not authorized to post in this discussion.');
      } else {
        setMessageError("Couldn't send your message. Please try again.");
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const handleToggleAcknowledgement = async () => {
    if (!currentUser || !selectedProblem?.id) return;
    try {
      await toggleProblemAcknowledgement({
        problemId: selectedProblem.id,
        workspaceId: selectedProblem.workspaceId,
        currentUser,
        userProfile,
        isAnonymous,
        pseudonym,
        eligibleMembers,
        thresholdPercentage: ackThreshold,
      });
    } catch (err) {
      console.error('[UNSAID Acknowledgement Error]', err);
    }
  };

  const handleVoteEscalation = async (voteOption) => {
    if (!currentUser || !selectedProblem?.id) return;
    try {
      await submitEscalationVote({
        problemId: selectedProblem.id,
        workspaceId: selectedProblem.workspaceId,
        vote: voteOption,
        currentUser,
        userProfile,
        isAnonymous,
        pseudonym,
      });
    } catch (err) {
      console.error('[UNSAID Escalation Error]', err);
    }
  };

  const handleQualityFeedback = async (rating) => {
    if (!currentUser || !selectedProblem?.id) return;
    try {
      await submitQualityFeedback({
        problemId: selectedProblem.id,
        workspaceId: selectedProblem.workspaceId,
        rating,
        currentUser,
        userProfile,
      });
    } catch (err) {
      console.error('[UNSAID Feedback Error]', err);
    }
  };

  const handleBroadcastResolution = async (e) => {
    e.preventDefault();
    if (!resolutionText.trim() || !selectedProblem?.id) return;

    setPublishingResolution(true);
    try {
      await broadcastOfficialResolution({
        problemId: selectedProblem.id,
        resolutionText: resolutionText.trim(),
        actionTaken: resolutionActionTaken.trim(),
        currentUser,
        userProfile,
      });

      const updated = {
        ...selectedProblem,
        status: 'solved',
        officialResolution: {
          problemId: selectedProblem.id,
          workspaceId: selectedProblem.workspaceId,
          resolutionText: resolutionText.trim(),
          actionTaken: resolutionActionTaken.trim(),
          resolvedBy: currentUser?.uid,
          resolvedByName: userProfile?.fullName || currentUser?.displayName || 'Workspace Admin',
          resolvedAt: new Date().toISOString(),
          isOfficial: true,
        },
      };

      setLocalProblemOverride(updated);
      setShowResolutionModal(false);
      setResolutionText('');
      setResolutionActionTaken('');
      if (onProblemUpdated) onProblemUpdated(updated);
    } catch (err) {
      console.error('[UNSAID Publish Resolution Error]', err);
    } finally {
      setPublishingResolution(false);
    }
  };

  const handleMarkRecurring = async (e) => {
    e.preventDefault();
    if (!linkedProblemId || !selectedProblem?.id) return;

    setSavingRecurrence(true);
    try {
      const linked = problems.find((p) => p.id === linkedProblemId);
      const rec = await markProblemRecurring({
        problemId: selectedProblem.id,
        linkedProblemId,
        linkedProblemTitle: linked?.title || 'Prior Problem',
        recurrenceCount,
        currentUser,
      });

      const updated = {
        ...selectedProblem,
        isRecurring: true,
        recurrenceOf: rec.recurrenceOf,
        linkedProblemId: rec.recurrenceOf,
        linkedProblemTitle: rec.linkedProblemTitle,
        recurrenceCount: rec.recurrenceCount,
      };

      setLocalProblemOverride(updated);
      setShowRecurrenceModal(false);
      if (onProblemUpdated) onProblemUpdated(updated);
    } catch (err) {
      console.error('[UNSAID Mark Recurring Error]', err);
    } finally {
      setSavingRecurrence(false);
    }
  };

  const handleToggleSolved = async () => {
    if (!selectedProblem?.id) return;
    const isCurrentlySolved = selectedProblem.status === 'solved';
    const nextStatus = isCurrentlySolved ? 'open' : 'solved';

    try {
      await updateProblemStatus(selectedProblem.id, nextStatus);
      const updated = {
        ...selectedProblem,
        status: nextStatus,
        solvedAt: nextStatus === 'solved' ? new Date().toISOString() : null,
      };
      setLocalProblemOverride(updated);
      if (onProblemUpdated) onProblemUpdated(updated);
    } catch (err) {
      console.error('[UNSAID Toggle Solved Error]', err);
    }
  };

  // Sync AI analysis when selectedProblem changes
  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) {
        setAiTriageAnalysis(selectedProblem?.aiAnalysis || null);
        setAiTriageError('');
      }
    });
    return () => {
      ignore = true;
    };
  }, [selectedProblem?.id, selectedProblem?.aiAnalysis]);

  const handleRunAIAnalyze = async () => {
    if (!selectedProblem || !workspace?.id) return;
    setAnalyzingWithAI(true);
    setAiTriageError('');

    try {
      const res = await fetchAIResolution({
        workspaceId: workspace.id,
        title: selectedProblem.title,
        description: selectedProblem.description,
        category: selectedProblem.category,
        subIssue: selectedProblem.subIssue,
        workaround: selectedProblem.workaround,
        isEmergency: selectedProblem.isEmergency,
        candidateProblems: problems.filter((p) => p.id !== selectedProblem.id),
      });

      if (res.available && res.analysis) {
        setAiTriageAnalysis(res.analysis);
      } else {
        setAiTriageError(res.message || 'AI analysis temporarily unavailable.');
      }
    } catch (err) {
      console.error('[UNSAID AI Triage Error]', err);
      setAiTriageError('Failed to run AI analysis.');
    } finally {
      setAnalyzingWithAI(false);
    }
  };

  const toggleDismissReveal = (msgId) => {
    setRevealedDismissedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const otherProblems = useMemo(() => {
    return problems.filter((p) => p.id !== selectedProblem?.id);
  }, [problems, selectedProblem?.id]);

  return (
    <div className="space-y-4">
      {/* 1. Header Filter Bar */}
      <GlassCard variant="panel" className="p-4 border border-[var(--glass-border)] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <span>UNSAID / Query Triage</span>
              <Badge variant="cyan" size="sm">
                Interactive Workspace
              </Badge>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Multi-channel issue resolution, live discussion thread, community polls, and verification.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--text-muted)]">
              Workspace:{' '}
              <strong className="text-[var(--text)]">
                {workspace?.name || 'Default Workspace'}
              </strong>
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<Bot className="w-3.5 h-3.5 text-[var(--cyan)]" />}
              onClick={() => setShowAISummaryModal(true)}
              className="text-xs h-7 ml-1"
            >
              AI Summary
            </Button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queries..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] px-2.5 py-1.5 rounded-xl border border-[var(--glass-border)] text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] shrink-0">
              Priority:
            </span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="emergency">Emergency Only</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] px-2.5 py-1.5 rounded-xl border border-[var(--glass-border)] text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] shrink-0">
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Active / Open</option>
              <option value="solved">Resolved / Solved</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-hover)] px-2.5 py-1.5 rounded-xl border border-[var(--glass-border)] text-xs">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] shrink-0">
              Category:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* 2. Split Workspace Layout (Desktop: Left List + Right Panel; Mobile: Stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ========================================================= */}
        {/* LEFT / MAIN: PROBLEM LIST                                  */}
        {/* ========================================================= */}
        <div
          className={`lg:col-span-5 space-y-2.5 ${
            mobileDetailOpen ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="flex items-center justify-between text-xs px-1 text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            <span>Query Queue ({filteredProblems.length})</span>
            <span>Sorted by Urgency</span>
          </div>

          {loading ? (
            <GlassCard className="py-16 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span>Loading queries...</span>
            </GlassCard>
          ) : filteredProblems.length === 0 ? (
            <GlassCard className="py-14 text-center text-xs text-[var(--text-muted)] space-y-2">
              <AlertCircle className="w-7 h-7 mx-auto opacity-40 text-[var(--text-muted)]" />
              <p className="font-semibold text-[var(--text)]">No queries matching filter criteria</p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Try clearing your search query or selecting &quot;All Priorities&quot;.
              </p>
              {(searchQuery || priorityFilter !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setPriorityFilter('all');
                    setStatusFilter('all');
                    setCategoryFilter('all');
                  }}
                  className="mt-2 text-xs"
                >
                  Reset Filters
                </Button>
              )}
            </GlassCard>
          ) : (
            <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredProblems.map((prob) => {
                const isSelected = selectedProblem?.id === prob.id;
                const isEmerg = prob.isEmergency || prob.priority === 'emergency';
                const isSolved = prob.status === 'solved' || prob.status === 'resolved';

                return (
                  <div
                    key={prob.id}
                    onClick={() => handleSelect(prob)}
                    className={`group p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left relative ${
                      isSelected
                        ? 'bg-[var(--surface-hover)] border-[var(--primary)] shadow-md ring-1 ring-[var(--primary)]/40'
                        : isSolved
                        ? 'bg-[var(--surface)]/50 border-[var(--glass-border)] opacity-65 hover:opacity-100 hover:border-[var(--primary)]/50'
                        : isEmerg
                        ? 'bg-[var(--danger)]/5 border-[var(--danger)]/40 hover:bg-[var(--danger)]/10 hover:border-[var(--danger)]'
                        : 'bg-[var(--surface)] border-[var(--glass-border)] hover:bg-[var(--surface-hover)] hover:border-[var(--glass-border)]'
                    }`}
                  >
                    {/* Top Row: Badges & Recurrence */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isEmerg && (
                          <Badge variant="high" size="sm" dot>
                            EMERGENCY
                          </Badge>
                        )}
                        <Badge
                          variant={
                            prob.priority === 'high'
                              ? 'high'
                              : prob.priority === 'low'
                              ? 'low'
                              : 'medium'
                          }
                          size="sm"
                        >
                          {prob.priority ? prob.priority.toUpperCase() : 'NORMAL'}
                        </Badge>
                        <Badge
                          variant={isSolved ? 'low' : 'warning'}
                          size="sm"
                          dot
                        >
                          {isSolved ? 'SOLVED' : 'OPEN'}
                        </Badge>
                        {prob.isRecurring && (
                          <Badge variant="cyan" size="sm" icon={<RotateCcw className="w-2.5 h-2.5" />}>
                            #{prob.recurrenceCount || 2}
                          </Badge>
                        )}
                      </div>

                      <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                        {formatTimeAgo(prob.updatedAt || prob.createdAt)}
                      </span>
                    </div>

                    {/* Problem Title & Snippet */}
                    <h4 className="text-sm font-bold text-[var(--text)] tracking-tight line-clamp-1 group-hover:text-[var(--primary)] transition-colors">
                      {prob.title || 'Untitled Query'}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1 leading-relaxed">
                      {prob.description || 'No description provided.'}
                    </p>

                    {/* Bottom Row: Votes / Acks / Feedback / Author */}
                    <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-[var(--glass-border)] text-[11px] text-[var(--text-muted)]">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[120px]">
                          By {prob.authorName || prob.authorEmail || 'Member'}
                        </span>
                        <span>•</span>
                        <span className="text-[var(--cyan)] font-medium">
                          {prob.category || 'General'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(prob.upvotesCount > 0 || prob.upvotedBy?.length > 0) && (
                          <span className="inline-flex items-center gap-0.5 text-[var(--primary)] font-semibold">
                            <ThumbsUp className="w-3 h-3" />
                            {prob.upvotesCount || prob.upvotedBy?.length}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT / MAIN: SELECTED PROBLEM DETAIL & TRIAGE WORKSPACE  */}
        {/* ========================================================= */}
        <div
          className={`lg:col-span-7 ${
            mobileDetailOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {!selectedProblem ? (
            <GlassCard variant="panel" className="py-24 text-center space-y-3 border border-[var(--glass-border)]">
              <Activity className="w-10 h-10 mx-auto opacity-30 text-[var(--primary)]" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text)]">No Query Selected</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                  Select a query from the left queue to inspect discussion threads, community polls, verification metrics, and publish official staff resolutions.
                </p>
              </div>
            </GlassCard>
          ) : (
            <GlassCard
              variant="panel"
              className="p-5 border border-[var(--glass-border)] space-y-4 shadow-lg"
            >
              {/* Mobile Back Button */}
              <div className="lg:hidden pb-1 border-b border-[var(--glass-border)]">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowLeft className="w-3.5 h-3.5" />}
                  onClick={() => setMobileDetailOpen(false)}
                >
                  Back to Query List
                </Button>
              </div>

              {/* Problem Header & Badges */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedProblem.isEmergency && (
                      <Badge variant="high" size="sm" dot>
                        EMERGENCY
                      </Badge>
                    )}
                    <Badge
                      variant={
                        selectedProblem.priority === 'high'
                          ? 'high'
                          : selectedProblem.priority === 'low'
                          ? 'low'
                          : 'medium'
                      }
                      size="sm"
                    >
                      {selectedProblem.priority ? selectedProblem.priority.toUpperCase() : 'NORMAL'}
                    </Badge>
                    <Badge
                      variant={
                        selectedProblem.status === 'solved' || selectedProblem.status === 'resolved'
                          ? 'low'
                          : 'warning'
                      }
                      size="sm"
                      dot
                    >
                      {selectedProblem.status === 'solved' || selectedProblem.status === 'resolved'
                        ? 'SOLVED'
                        : 'OPEN'}
                    </Badge>
                    {selectedProblem.isRecurring && (
                      <Badge variant="cyan" size="sm" icon={<RotateCcw className="w-3 h-3" />}>
                        Recurring (#{selectedProblem.recurrenceCount || 2})
                      </Badge>
                    )}
                    <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--glass-border)]">
                      #{selectedProblem.id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      Workspace: {workspace?.name || 'Current'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteError('');
                        setShowDeleteModal(true);
                      }}
                      className="text-xs text-[var(--danger)] hover:bg-[var(--danger)]/15 h-7 px-2"
                      icon={<Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <h3 className="text-lg font-extrabold text-[var(--text)] tracking-tight">
                  {selectedProblem.title || 'Untitled Query'}
                </h3>

                <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {selectedProblem.description}
                </p>

                {selectedProblem.workaround && (
                  <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs space-y-1">
                    <span className="font-semibold text-[var(--text)] block text-[11px]">
                      💡 Member Proposed Workaround:
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                      {selectedProblem.workaround}
                    </p>
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* UNSAID AI TRIAGE ASSESSMENT & RECOMMENDATIONS              */}
              {/* ========================================================= */}
              <div className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--cyan)]/25 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[var(--cyan)]/15 text-[var(--cyan)] flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-bold text-[var(--text)]">
                      UNSAID AI Triage Assessment
                    </span>
                    {aiTriageAnalysis && (
                      <Badge variant="cyan" size="sm">
                        AI Assessment
                      </Badge>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant={aiTriageAnalysis ? 'ghost' : 'secondary'}
                    size="sm"
                    icon={analyzingWithAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-[var(--cyan)]" />}
                    onClick={handleRunAIAnalyze}
                    isLoading={analyzingWithAI}
                    disabled={analyzingWithAI}
                    className="text-xs h-7"
                  >
                    {aiTriageAnalysis ? 'Re-analyze with AI' : 'AI Analyze'}
                  </Button>
                </div>

                {/* If analysis is available */}
                {aiTriageAnalysis && (
                  <div className="space-y-3 pt-1 text-xs">
                    {/* User AI Escalation Banner */}
                    {(aiTriageAnalysis.escalatedFromAI || selectedProblem?.aiAnalysis?.escalatedFromAI) && (
                      <div className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2 text-[var(--danger)] font-medium">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Escalated from User AI: The user attempted the AI solution below, but it did not resolve their issue.</span>
                        </div>
                        <Badge variant="high" size="sm">
                          AI Escalation
                        </Badge>
                      </div>
                    )}

                    {/* Priority Comparison Notice */}
                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Priority Evaluation:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Admin Priority: <strong className="uppercase">{selectedProblem.priority || 'normal'}</strong>
                        </span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span className="text-[11px] font-semibold text-[var(--cyan)]">
                          AI recommends {aiTriageAnalysis.priority ? (aiTriageAnalysis.priority.charAt(0).toUpperCase() + aiTriageAnalysis.priority.slice(1)) : 'Normal'} priority
                        </span>
                        <Badge
                          variant={
                            aiTriageAnalysis.priority === 'high'
                              ? 'high'
                              : aiTriageAnalysis.priority === 'low'
                              ? 'low'
                              : 'medium'
                          }
                          size="sm"
                        >
                          {aiTriageAnalysis.priority ? aiTriageAnalysis.priority.toUpperCase() : 'NORMAL'}
                        </Badge>
                      </div>
                    </div>

                    {/* Problem Summary & Likely Cause */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[var(--cyan)] block">
                          Problem Summary
                        </span>
                        <p className="text-[11px] text-[var(--text)] leading-relaxed">
                          {aiTriageAnalysis.summary}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                          Likely Cause
                        </span>
                        <p className="text-[11px] text-[var(--text)] leading-relaxed">
                          {aiTriageAnalysis.likelyCause || 'Operational or physical malfunction'}
                        </p>
                      </div>
                    </div>

                    {/* Suggested Next Action & Human Attention */}
                    <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-[var(--cyan)]" />
                          Suggested Next Action
                        </span>
                        <Badge
                          variant={aiTriageAnalysis.needsHumanAttention ? 'warning' : 'low'}
                          size="sm"
                        >
                          {aiTriageAnalysis.needsHumanAttention ? 'Staff Action Required' : 'Self-Service Possible'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        {aiTriageAnalysis.suggestedWorkaround}
                      </p>
                    </div>
                  </div>
                )}

                {/* If error occurred */}
                {aiTriageError && (
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--warning)] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{aiTriageError}</span>
                  </div>
                )}

                {/* Prompt to analyze if none present yet */}
                {!aiTriageAnalysis && !aiTriageError && !analyzingWithAI && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Click "AI Analyze" to generate root cause insights, priority recommendations, and actionable triage steps.
                  </p>
                )}
              </div>

              {/* Metadata Bar */}
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                    Reported By
                  </span>
                  <span className="font-medium text-[var(--text)] truncate block mt-0.5">
                    {selectedProblem.authorName || selectedProblem.authorEmail || 'Member'}
                  </span>
                  {selectedProblem.authorEmail && (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono truncate block mt-0.5">
                      {selectedProblem.authorEmail}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                    Created
                  </span>
                  <span className="font-medium text-[var(--text)] block mt-0.5">
                    {formatFullTime(selectedProblem.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                    Current Shift
                  </span>
                  <span className="font-medium text-[var(--cyan)] block mt-0.5">
                    {shiftStatus.shiftText}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                    Category
                  </span>
                  <span className="font-medium text-[var(--text)] block mt-0.5">
                    {selectedProblem.category || 'General'}
                  </span>
                </div>
              </div>

              {/* Official Resolution Banner (if published) */}
              {selectedProblem.officialResolution && (
                <div className="p-4 rounded-2xl bg-[var(--success-light)]/20 border-2 border-[var(--success)]/60 text-[var(--text)] space-y-2 shadow-sm ring-1 ring-[var(--success)]/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Badge variant="low" size="sm" icon={<Award className="w-3.5 h-3.5" />}>
                      OFFICIAL RESOLUTION
                    </Badge>
                    <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatFullTime(selectedProblem.officialResolution.resolvedAt)}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-[var(--text)]">
                    {selectedProblem.officialResolution.resolutionText}
                  </div>

                  {selectedProblem.officialResolution.actionTaken && (
                    <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--glass-border)]">
                      <strong className="block text-[11px] text-[var(--text)] mb-0.5">
                        Action Taken:
                      </strong>
                      {selectedProblem.officialResolution.actionTaken}
                    </div>
                  )}

                  <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 pt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--success)]" />
                    <span>Verified by:</span>
                    <strong className="text-[var(--text)]">
                      {selectedProblem.officialResolution.resolvedByName || 'Workspace Administration'}
                    </strong>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* ACKNOWLEDGEMENT & ESCALATION METRICS PROGRESS CARD        */}
              {/* ========================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs">
                {/* Dynamic Acknowledgement Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                      Acknowledgement
                    </span>
                    <span className="font-mono font-bold text-[var(--text)]">
                      {ackCount} / {eligibleMembers} members ({ackPercentage}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden border border-[var(--glass-border)]">
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
                    <span>Threshold: {ackThreshold}%</span>
                    {ackPercentage >= ackThreshold ? (
                      <span className="text-[var(--success)] font-bold">
                        Community acknowledgement threshold reached
                      </span>
                    ) : (
                      <span>{Math.max(0, ackThreshold - ackPercentage)}% needed</span>
                    )}
                  </div>
                </div>

                {/* Community Escalation Status */}
                <div className="space-y-2 border-t md:border-t-0 md:border-l border-[var(--glass-border)] pt-2 md:pt-0 md:pl-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--danger)]" />
                      Community Escalation
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {totalEscVotes === 0 ? 'No votes' : `${totalEscVotes} votes`}
                    </span>
                  </div>

                  {totalEscVotes > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[var(--danger)]">
                          Yes {yesPercentage}%
                        </span>
                        <span className="text-[var(--text-muted)]">
                          No {noPercentage}%
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
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)] italic">
                      No escalation responses yet.
                    </p>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* ACTION BAR: QUICK ACTIONS (Acknowledge, Escalate, etc.)    */}
              {/* ========================================================= */}
              <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Dynamic Acknowledgement Button */}
                  <Button
                    variant={hasUserAcked ? 'secondary' : 'primary'}
                    size="sm"
                    icon={<Check className="w-3.5 h-3.5" />}
                    onClick={handleToggleAcknowledgement}
                    className="text-xs"
                  >
                    {hasUserAcked ? 'Acknowledged' : 'Acknowledge'}
                  </Button>

                  {/* Escalation Vote Quick Trigger */}
                  <Button
                    variant={userEscVote === 'yes' ? 'danger' : 'ghost'}
                    size="sm"
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                    onClick={() => handleVoteEscalation(userEscVote === 'yes' ? 'no' : 'yes')}
                    className="text-xs"
                  >
                    {userEscVote === 'yes' ? 'Escalated (Yes)' : 'Escalate'}
                  </Button>

                  {/* Feedback Quick Action (if solved) */}
                  {selectedProblem.status === 'solved' && (
                    <div className="flex items-center gap-1 bg-[var(--surface-hover)] px-2 py-1 rounded-xl border border-[var(--glass-border)]">
                      <span className="text-[11px] text-[var(--text-muted)]">Feedback:</span>
                      <button
                        type="button"
                        onClick={() => handleQualityFeedback('solved')}
                        title="Solved"
                        className={`text-xs px-1.5 py-0.5 rounded cursor-pointer ${
                          userFeedback === 'solved' ? 'bg-[var(--success)] text-white font-bold' : ''
                        }`}
                      >
                        🟢
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQualityFeedback('partially_solved')}
                        title="Partially Solved"
                        className={`text-xs px-1.5 py-0.5 rounded cursor-pointer ${
                          userFeedback === 'partially_solved'
                            ? 'bg-[var(--warning)] text-white font-bold'
                            : ''
                        }`}
                      >
                        🟡
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQualityFeedback('still_confused')}
                        title="Still Confused"
                        className={`text-xs px-1.5 py-0.5 rounded cursor-pointer ${
                          userFeedback === 'still_confused'
                            ? 'bg-[var(--danger)] text-white font-bold'
                            : ''
                        }`}
                      >
                        🔴
                      </button>
                    </div>
                  )}

                  {/* Recurrence Link Trigger */}
                  {!selectedProblem.isRecurring && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw className="w-3.5 h-3.5 text-[var(--cyan)]" />}
                      onClick={() => setShowRecurrenceModal(true)}
                      className="text-xs"
                    >
                      Mark Recurring
                    </Button>
                  )}
                </div>

                {/* Admin Status / Resolve Control */}
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Award className="w-3.5 h-3.5 text-[var(--success)]" />}
                        onClick={() => setShowResolutionModal(true)}
                        className="text-xs"
                      >
                        {selectedProblem.officialResolution ? 'Update Resolution' : 'Publish Resolution'}
                      </Button>
                      <Button
                        variant={selectedProblem.status === 'solved' ? 'ghost' : 'primary'}
                        size="sm"
                        icon={
                          selectedProblem.status === 'solved' ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )
                        }
                        onClick={handleToggleSolved}
                        className="text-xs"
                      >
                        {selectedProblem.status === 'solved' ? 'Reopen' : 'Resolve'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* TABS: [ Discussion ] [ Poll ] [ Activity ]                */}
              {/* ========================================================= */}
              <div className="border-b border-[var(--glass-border)] flex items-center gap-2 pt-1">
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
                  {poll && (
                    <span className="w-2 h-2 rounded-full bg-[var(--cyan)] animate-pulse" />
                  )}
                </button>

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
                <div className="space-y-3">
                  {/* Messages Feed */}
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {loadingMessages ? (
                      <div className="py-12 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                        <span>Loading discussion...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
                        <MessageSquare className="w-7 h-7 mx-auto opacity-40 text-[var(--primary)]" />
                        <p className="font-semibold text-[var(--text)]">No discussion yet.</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Start the conversation below. Staff and members can communicate here in real-time.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMsgAuthor =
                          msg.senderId === currentUser?.uid || msg.authorId === currentUser?.uid;
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
                                onClick={() => toggleDismissReveal(msg.id)}
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
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <strong
                                  className={`font-semibold ${
                                    isOfficial
                                      ? 'text-[var(--primary)]'
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

                              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                                <span>{formatTimeAgo(msg.createdAt)}</span>

                                {(isAdmin || isMsgAuthor) && !msg.isDismissed && (
                                  <button
                                    type="button"
                                    onClick={() => dismissProblemMessage(msg.id, currentUser?.uid)}
                                    title="Mark unhelpful"
                                    className="p-1 hover:text-[var(--danger)] cursor-pointer transition-colors"
                                  >
                                    <Flag className="w-3 h-3" />
                                  </button>
                                )}

                                {isDismissed && isRevealed && (
                                  <button
                                    type="button"
                                    onClick={() => toggleDismissReveal(msg.id)}
                                    title="Hide comment"
                                    className="hover:text-[var(--text)] cursor-pointer"
                                  >
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed text-xs">
                              {msg.message || msg.text}
                            </p>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Composer */}
                  <form onSubmit={handleSendMessage} className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
                    {messageError && (
                      <div className="p-2 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center justify-between">
                        <span>{messageError}</span>
                        <button
                          type="button"
                          onClick={() => setMessageError('')}
                          className="hover:opacity-70"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <textarea
                        rows={2}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={
                          isAdmin
                            ? isOfficialToggle
                              ? 'Write an official staff response (Enter to send)...'
                              : 'Write a reply... (Enter to send, Shift+Enter for newline)'
                            : isAnonymous
                            ? `Reply as ${pseudonym}...`
                            : 'Write a reply... (Enter to send)'
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        {isAdmin && (
                          <label className="flex items-center gap-1.5 text-xs text-[var(--text)] cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isOfficialToggle}
                              onChange={(e) => setIsOfficialToggle(e.target.checked)}
                              className="rounded border-[var(--glass-border)] text-[var(--primary)] focus:ring-0 cursor-pointer"
                            />
                            <span className="font-semibold text-[var(--primary)] flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Reply as Official Staff
                            </span>
                          </label>
                        )}
                      </div>

                      <Button
                        type="submit"
                        variant={isOfficialToggle ? 'secondary' : 'primary'}
                        size="sm"
                        isLoading={sendingMessage}
                        disabled={sendingMessage || !messageInput.trim()}
                        icon={<Send className="w-3.5 h-3.5" />}
                        className="text-xs"
                      >
                        {isOfficialToggle ? 'Publish Official Reply' : 'Send'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB CONTENT 2: COMMUNITY POLL                             */}
              {/* ========================================================= */}
              {activeTab === 'poll' && (
                <div className="pt-1">
                  <CommunityPollWidget
                    problemId={selectedProblem.id}
                    workspaceId={selectedProblem.workspaceId}
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
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
                    <span>Audit & Resolution History</span>
                    <span className="font-mono">{activityTimeline.length} recorded events</span>
                  </div>

                  {activityTimeline.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
                      <Activity className="w-7 h-7 mx-auto opacity-40 text-[var(--text-muted)]" />
                      <p className="font-semibold text-[var(--text)]">No recorded events yet.</p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-[var(--glass-border)]">
                      {activityTimeline.map((evt) => (
                        <div key={evt.id} className="relative space-y-1 text-xs">
                          {/* Dot indicator */}
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
                              {formatFullTime(evt.timestamp)}
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
            </GlassCard>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: PUBLISH OFFICIAL RESOLUTION                        */}
      {/* ========================================================= */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <GlassCard
            variant="panel"
            className="w-full max-w-lg p-5 border border-[var(--glass-border)] space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <Award className="w-4 h-4 text-[var(--success)]" />
                <span>Publish Official Resolution</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowResolutionModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBroadcastResolution} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Resolution Explanation <span className="text-[var(--danger)]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Explain how this issue was resolved..."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-y"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Action Taken / Member Advice (Optional)
                </label>
                <textarea
                  rows={2}
                  value={resolutionActionTaken}
                  onChange={(e) => setResolutionActionTaken(e.target.value)}
                  placeholder="e.g. Cleared cache, updated switch firmware. If issues persist, reconnect."
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] resize-y"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResolutionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={publishingResolution}
                  disabled={publishingResolution || !resolutionText.trim()}
                  icon={<Award className="w-3.5 h-3.5" />}
                >
                  Publish Official Resolution
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MARK RECURRING                                     */}
      {/* ========================================================= */}
      {showRecurrenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <GlassCard
            variant="panel"
            className="w-full max-w-md p-5 border border-[var(--glass-border)] space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
              <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[var(--cyan)]" />
                <span>Mark as Recurring Issue</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRecurrenceModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMarkRecurring} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Link to Previous Problem <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  required
                  value={linkedProblemId}
                  onChange={(e) => setLinkedProblemId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none"
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
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Occurrence #
                </label>
                <input
                  type="number"
                  min={2}
                  max={25}
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRecurrenceModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={savingRecurrence}
                  disabled={savingRecurrence || !linkedProblemId}
                  icon={<Link2 className="w-3.5 h-3.5" />}
                >
                  Confirm Link
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Delete Query Modal */}
      {showDeleteModal && selectedProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
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
              <p className="text-xs font-bold text-[var(--text)] line-clamp-1">{selectedProblem.title}</p>
              <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{selectedProblem.description}</p>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Are you sure you want to delete this query? It will be permanently removed along with all messages, acknowledgements, and triage history.
            </p>

            {deleteError && (
              <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 p-2.5 rounded-xl border border-[var(--danger)]/20">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deletingQuery}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deletingQuery}
                disabled={deletingQuery}
                onClick={handleDeleteQuery}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Query
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Executive Summary Modal */}
      <AdminAISummaryModal
        isOpen={showAISummaryModal}
        onClose={() => setShowAISummaryModal(false)}
        workspace={workspace}
        problems={problems}
      />
    </div>
  );
};
