import React, { useState, useMemo } from 'react';
import {
  Clock,
  ThumbsUp,
  Search,
  Inbox,
  MessageSquare,
  Award,
  RotateCcw,
  TrendingUp,
  CheckCircle2,
  Lock,
  CloudOff,
  Trash2,
  AlertTriangle,
  User,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ProblemDetailsModal } from './ProblemDetailsModal';
import { toggleProblemUpvote, deleteProblem } from '../../services/problemService';
import { useAuth } from '../../hooks/useAuth';

export const ProblemFeed = ({
  problems = [],
  loading = false,
  workspace,
  currentUser,
  onOpenReportModal,
  onRefresh,
}) => {
  const { currentUser: authUser, userProfile } = useAuth();
  const effectiveUser = currentUser || authUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'mine' | 'open' | 'emergency' | 'solved' | 'confidential'
  const [upvotingId, setUpvotingId] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);

  // Delete State
  const [problemToDelete, setProblemToDelete] = useState(null);
  const [deletingProblem, setDeletingProblem] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const canDeleteProblem = (prob) => {
    if (!effectiveUser?.uid) return false;
    return (
      prob.authorId === effectiveUser.uid ||
      prob.createdBy === effectiveUser.uid ||
      (prob.authorEmail && effectiveUser.email && prob.authorEmail === effectiveUser.email) ||
      userProfile?.role === 'admin' ||
      workspace?.createdBy === effectiveUser.uid
    );
  };

  const filteredProblems = useMemo(() => {
    return problems.filter((prob) => {
      // 1. My queries filter
      if (statusFilter === 'mine') {
        if (!effectiveUser?.uid) return false;
        const isMine =
          prob.authorId === effectiveUser.uid ||
          prob.createdBy === effectiveUser.uid ||
          (prob.authorEmail && effectiveUser.email && prob.authorEmail === effectiveUser.email);
        if (!isMine) return false;
      }

      // 2. Confidential filter: private threads never appear in public feed tabs
      if (statusFilter === 'confidential') {
        if (!prob.isConfidential) return false;
      } else if (statusFilter !== 'mine') {
        if (prob.isConfidential) return false;
      }

      // Archived problems (threshold reached >= 65%) are removed from active feed, but can be viewed under "solved" or history
      if (statusFilter !== 'solved' && statusFilter !== 'confidential' && statusFilter !== 'mine' && (prob.isArchivedFromFeed || prob.acknowledgementReached)) {
        return false;
      }

      // Status filtering
      if (statusFilter === 'open' && prob.status !== 'open') return false;
      if (statusFilter === 'solved' && prob.status !== 'solved') return false;
      if (statusFilter === 'emergency' && !prob.isEmergency) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = prob.title?.toLowerCase().includes(q);
        const matchesDesc = prob.description?.toLowerCase().includes(q);
        const matchesCategory = prob.category?.toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesCategory;
      }

      return true;
    });
  }, [problems, statusFilter, searchQuery, effectiveUser]);

  const activeCount = useMemo(
    () => problems.filter((p) => !p.isConfidential && !p.isArchivedFromFeed && !p.acknowledgementReached).length,
    [problems]
  );
  const myCount = useMemo(
    () =>
      problems.filter((p) =>
        Boolean(
          effectiveUser?.uid &&
            (p.authorId === effectiveUser.uid ||
              p.createdBy === effectiveUser.uid ||
              (p.authorEmail && effectiveUser.email && p.authorEmail === effectiveUser.email))
        )
      ).length,
    [problems, effectiveUser]
  );
  const emergencyCount = useMemo(
    () => problems.filter((p) => !p.isConfidential && p.isEmergency && !p.isArchivedFromFeed && !p.acknowledgementReached).length,
    [problems]
  );
  const openCount = useMemo(
    () => problems.filter((p) => !p.isConfidential && p.status === 'open' && !p.isArchivedFromFeed && !p.acknowledgementReached).length,
    [problems]
  );
  const solvedCount = useMemo(
    () => problems.filter((p) => !p.isConfidential && (p.status === 'solved' || p.isArchivedFromFeed || p.acknowledgementReached)).length,
    [problems]
  );
  const confidentialCount = useMemo(
    () => problems.filter((p) => p.isConfidential).length,
    [problems]
  );

  const handleUpvote = async (problemId) => {
    if (!effectiveUser?.uid || !workspace?.id || upvotingId === problemId) return;
    setUpvotingId(problemId);
    try {
      await toggleProblemUpvote(problemId, effectiveUser.uid, workspace.id);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('[UNSAID Upvote Error]', err);
    } finally {
      setUpvotingId(null);
    }
  };

  const handleDeleteProblemConfirm = async () => {
    if (!problemToDelete?.id) return;
    setDeletingProblem(true);
    setDeleteError('');
    try {
      await deleteProblem(problemToDelete.id, workspace?.id || problemToDelete.workspaceId);
      if (selectedProblem?.id === problemToDelete.id) {
        setSelectedProblem(null);
      }
      setProblemToDelete(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('[UNSAID Delete Problem Error]', err);
      setDeleteError(err.message || 'Failed to delete query. Please try again.');
    } finally {
      setDeletingProblem(false);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Just now';
    const date =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : typeof ts === 'string' || typeof ts === 'number'
        ? new Date(ts)
        : null;
    if (!date) return 'Recently';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problems by keyword or category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('mine')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'mine'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Queries ({myCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('emergency')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'emergency'
                ? 'bg-[var(--danger)] text-white border-[var(--danger)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--danger)]'
            }`}
          >
            Emergency ({emergencyCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'open'
                ? 'bg-[var(--cyan)] text-white border-[var(--cyan)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('solved')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'solved'
                ? 'bg-[var(--success)] text-white border-[var(--success)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text-secondary)]'
            }`}
          >
            Solved / History ({solvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('confidential')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'confidential'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--primary)]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Confidential 1-on-1 ({confidentialCount})</span>
          </button>
        </div>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[var(--text-muted)] animate-pulse">
          Loading workspace queries...
        </div>
      ) : filteredProblems.length === 0 ? (
        <GlassCard variant="panel" className="py-14 px-6 text-center space-y-3 border border-[var(--glass-border)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <Inbox className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[var(--text)]">
              {searchQuery ? 'No matching problems found' : 'No queries in active feed'}
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search terms or filter selection.'
                : 'Queries that reach the acknowledgement threshold are archived to history.'}
            </p>
          </div>
          {!searchQuery && (
            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onOpenReportModal}
                disabled={!workspace}
                title={!workspace ? 'Please select or join an active workspace first' : undefined}
              >
                Report First Issue
              </Button>
            </div>
          )}
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filteredProblems.map((prob) => {
            const hasUserUpvoted = currentUser?.uid && prob.upvotedBy?.includes(currentUser.uid);
            const isEmergency = Boolean(prob.isEmergency);
            const isSolved = prob.status === 'solved';
            const totalEscalationVotes =
              (prob.escalationVotes?.yes?.length || 0) + (prob.escalationVotes?.no?.length || 0);

            return (
              <GlassCard
                key={prob.id}
                glow={isEmergency}
                className={`p-5 space-y-3.5 transition-all ${
                  isEmergency
                    ? 'border-2 border-[var(--danger)]/70 ring-2 ring-[var(--danger)]/20 shadow-md animate-pulse motion-reduce:animate-none bg-[var(--danger-light)]/20'
                    : isSolved
                    ? 'border border-[var(--glass-border)] opacity-75 bg-[var(--surface)]/40 hover:opacity-100'
                    : 'border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]'
                }`}
              >
                {/* Header Row: Category, Emergency Tag, and Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEmergency && (
                      <Badge variant="high" size="sm" dot>
                        EMERGENCY
                      </Badge>
                    )}
                    {prob.isConfidential && (
                      <Badge variant="primary" size="sm" icon={<Lock className="w-3 h-3" />}>
                        Confidential DM
                      </Badge>
                    )}
                    {prob.isOfflineQueued && (
                      <Badge variant="warning" size="sm" icon={<CloudOff className="w-3 h-3" />}>
                        Queued Offline
                      </Badge>
                    )}
                    <Badge variant="cyan" size="sm">
                      {prob.category || 'General'}
                    </Badge>
                    {prob.subIssue && (
                      <Badge variant="neutral" size="sm">
                        {prob.subIssue}
                      </Badge>
                    )}
                    {prob.isRecurring && (
                      <Badge variant="cyan" size="sm" icon={<RotateCcw className="w-3 h-3" />}>
                        Recurring (#{prob.recurringCount || 2})
                      </Badge>
                    )}
                    {prob.officialResolution && (
                      <Badge variant="low" size="sm" icon={<Award className="w-3 h-3" />}>
                        Official Resolution
                      </Badge>
                    )}
                    {prob.shiftStatus && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        · {prob.shiftStatus}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={prob.status === 'solved' ? 'low' : isEmergency ? 'high' : 'medium'}
                      size="sm"
                    >
                      {prob.status === 'solved' ? 'SOLVED' : 'OPEN'}
                    </Badge>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1">
                  <h3
                    onClick={() => setSelectedProblem(prob)}
                    className="text-base font-bold text-[var(--text)] tracking-tight hover:text-[var(--primary)] transition-colors cursor-pointer"
                  >
                    {prob.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line line-clamp-3">
                    {prob.description}
                  </p>
                </div>

                {/* Official Resolution Summary Preview if available */}
                {prob.officialResolution && (
                  <div className="p-3 rounded-xl bg-[var(--success-light)]/15 border border-[var(--success)]/30 text-xs space-y-1">
                    <span className="font-semibold text-[var(--success)] block text-[11px] flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      Official Resolution Broadcast:
                    </span>
                    <p className="text-[var(--text)] text-[11px] leading-relaxed">
                      {prob.officialResolution.summary}
                    </p>
                  </div>
                )}

                {/* Proposed Workaround if present */}
                {prob.workaround && !prob.officialResolution && (
                  <div className="p-3 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs space-y-1">
                    <span className="font-semibold text-[var(--text)] block text-[11px]">
                      💡 Community Workaround:
                    </span>
                    <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                      {prob.workaround}
                    </p>
                  </div>
                )}

                {/* Attached Photo Evidence Preview */}
                {prob.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-[var(--glass-border)] bg-[var(--surface)] max-h-52 flex items-center justify-center">
                    <img
                      src={prob.imageUrl}
                      alt={prob.title || 'Attached evidence'}
                      className="max-h-52 w-full object-cover rounded-xl cursor-pointer"
                      onClick={() => setSelectedProblem(prob)}
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Dynamic Metrics Bar: Acknowledgements & Escalation Poll */}
                {(prob.acknowledgementsCount > 0 || totalEscalationVotes > 0) && (
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-[var(--text-muted)] flex-wrap">
                    {prob.acknowledgementsCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[var(--success)] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {prob.acknowledgementsCount} confirmed resolved
                      </span>
                    )}
                    {totalEscalationVotes > 0 && (
                      <span className="inline-flex items-center gap-1 text-[var(--danger)] font-medium">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {prob.escalationVotes?.yes?.length || 0} escalation votes
                      </span>
                    )}
                  </div>
                )}

                {/* Footer: Author, Timestamp, Actions */}
                <div className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
                    {prob.isAnonymous ? (
                      <span className="font-semibold font-mono text-[var(--cyan)]" title="Anonymous Workspace Member">
                        {prob.authorName || 'Anon Member'}
                      </span>
                    ) : (
                      <span className="font-medium text-[var(--text)]">
                        {prob.authorName || 'Member'}
                      </span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(prob.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Delete Query Button (Allowed for author or admin) */}
                    {canDeleteProblem(prob) && (
                      <button
                        type="button"
                        disabled={deletingProblem && problemToDelete?.id === prob.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setProblemToDelete(prob);
                          setDeleteError('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--danger)]/30 bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] text-xs font-semibold transition-all cursor-pointer hover:scale-105 active:scale-95"
                        title="Delete this query if you made a mistake"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}

                    {/* View Thread & Discuss Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedProblem(prob)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--surface)] hover:bg-[var(--glass-hover)] text-xs font-semibold text-[var(--text)] transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Thread</span>
                    </button>

                    {/* Upvote Button */}
                    <button
                      type="button"
                      disabled={upvotingId === prob.id}
                      onClick={() => handleUpvote(prob.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                        hasUserUpvoted
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                          : 'bg-[var(--surface)] hover:bg-[var(--glass-hover)] border-[var(--glass-border)] text-[var(--text)]'
                      }`}
                      title="Upvote this problem to increase visibility"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${hasUserUpvoted ? 'fill-current' : ''}`} />
                      <span>{prob.upvotesCount || 0}</span>
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Interactive Triage & Discussion Details Modal */}
      {selectedProblem && (
        <ProblemDetailsModal
          isOpen={Boolean(selectedProblem)}
          onClose={() => setSelectedProblem(null)}
          problem={selectedProblem}
          workspace={workspace}
          allWorkspaceProblems={problems}
          onStatusChanged={() => {
            if (onRefresh) onRefresh();
          }}
          onProblemUpdated={(updated) => {
            setSelectedProblem(updated);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Delete Query Confirmation Modal */}
      {problemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Delete Query?</h3>
                <p className="text-xs text-[var(--text-muted)]">Permanent removal from workspace feed</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] space-y-1">
              <p className="text-xs font-bold text-[var(--text)] line-clamp-1">{problemToDelete.title}</p>
              <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{problemToDelete.description}</p>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              If you made a mistake or want to remove this query, deleting it will permanently remove it and its discussion thread from the workspace.
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
                  setProblemToDelete(null);
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
                onClick={handleDeleteProblemConfirm}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Query
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
