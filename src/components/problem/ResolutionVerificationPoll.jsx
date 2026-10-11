import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  Check,
  Users,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  subscribeToVerificationPoll,
  subscribeToVerificationVotes,
  submitVerificationVote,
  evaluateAndApplyVerificationOutcome,
  VERIFICATION_OPTIONS,
} from '../../services/verificationPollService';

/**
 * ResolutionVerificationPoll Component
 * 
 * Automatically delivers the verification question:
 * "Has this problem been resolved for you?"
 * exclusively to original reporters and affected users.
 */
export const ResolutionVerificationPoll = ({
  problemId,
  workspaceId,
  currentUser,
  userProfile,
  isAdmin = false,
  onStatusChanged = null,
  onProblemUpdated = null,
  className = '',
}) => {
  const [poll, setPoll] = useState(null);
  const [voteStats, setVoteStats] = useState({
    votes: [],
    counts: { Solved: 0, 'Partially Solved': 0, 'Not Solved': 0 },
    percentages: { Solved: 0, 'Partially Solved': 0, 'Not Solved': 0 },
    votedUserIds: [],
    rejections: [],
    totalVotes: 0,
  });
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [voteSuccess, setVoteSuccess] = useState('');
  const [showDetailedVotes, setShowDetailedVotes] = useState(false);
  const [elapsedText, setElapsedText] = useState('31:23');

  // Elapsed timer tracking
  useEffect(() => {
    const updateElapsed = () => {
      const base = poll?.resolvedAt || poll?.createdAt;
      if (!base) return;
      const start = new Date(base).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsedText(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [poll?.resolvedAt, poll?.createdAt]);

  const formatVoteTime = (ts) => {
    if (!ts) return 'Recently';
    const d =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts?.seconds
        ? new Date(ts.seconds * 1000)
        : ts instanceof Date
        ? ts
        : new Date(ts);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 1. Subscribe to active verification poll for this problem
  useEffect(() => {
    if (!problemId) return;
    const unsub = subscribeToVerificationPoll(
      problemId,
      (updatedPoll) => {
        setPoll(updatedPoll);
      },
      (err) => {
        console.warn('[UNSAID Verification Poll] Error subscribing to poll:', err);
      }
    );
    return () => unsub();
  }, [problemId]);

  // 2. Subscribe to votes for active resolution cycle
  useEffect(() => {
    if (!problemId || !poll?.resolutionCycleId) return;
    const unsub = subscribeToVerificationVotes(
      problemId,
      poll.resolutionCycleId,
      (stats) => {
        setVoteStats(stats);
      },
      (err) => {
        console.warn('[UNSAID Verification Votes] Error subscribing to votes:', err);
      }
    );
    return () => unsub();
  }, [problemId, poll?.resolutionCycleId]);

  // User's own vote for this resolution cycle
  const userVote = useMemo(() => {
    if (!currentUser?.uid || !voteStats.votes) return null;
    return voteStats.votes.find((v) => v.userId === currentUser.uid);
  }, [currentUser?.uid, voteStats.votes]);

  // Voter eligibility check
  const isEligibleReporter = useMemo(() => {
    if (!currentUser?.uid || !poll?.eligibleReporterIds) return false;
    return poll.eligibleReporterIds.includes(currentUser.uid);
  }, [currentUser?.uid, poll?.eligibleReporterIds]);

  const totalEligible = poll?.eligibleReporterIds?.length || 0;
  const votedCount = voteStats.votedUserIds?.length || 0;
  const pendingCount = Math.max(0, totalEligible - votedCount);
  const isActive = poll?.status === 'active';
  const isVerified = poll?.verificationStatus === 'verified';
  const isReopened = poll?.verificationStatus === 'rejected';

  // Handle vote submission
  const handleVote = async (option) => {
    if (!isEligibleReporter || !isActive || submittingVote) return;
    setSubmittingVote(true);
    setVoteError('');
    setVoteSuccess('');

    try {
      const savedVote = await submitVerificationVote({
        problemId,
        workspaceId: workspaceId || poll.workspaceId,
        resolutionCycleId: poll.resolutionCycleId,
        selectedOption: option,
        currentUser,
        userProfile,
      });

      setVoteSuccess(`Your verification vote "${option}" was saved.`);

      // Optimistically update votes list and evaluate outcome
      const currentCycleVotes = voteStats.votes.filter(
        (v) => v.resolutionCycleId === poll.resolutionCycleId && v.userId !== currentUser.uid
      );
      const combinedVotes = [...currentCycleVotes, savedVote];

      const outcome = await evaluateAndApplyVerificationOutcome({
        problemId,
        workspaceId: workspaceId || poll.workspaceId,
        resolutionCycleId: poll.resolutionCycleId,
        poll,
        votes: combinedVotes,
        currentUser,
      });

      if (outcome?.status === 'verified') {
        if (onStatusChanged) onStatusChanged(problemId, 'solved');
        if (onProblemUpdated) onProblemUpdated({ status: 'solved', verificationStatus: 'verified' });
      } else if (outcome?.status === 'reopened') {
        if (onStatusChanged) onStatusChanged(problemId, 'open');
        if (onProblemUpdated) onProblemUpdated({ status: 'open', verificationStatus: 'reopened' });
      }
    } catch (err) {
      console.error('[UNSAID Verification] Vote submission failed:', err);
      setVoteError(err.message || 'Failed to submit verification vote. Please try again.');
    } finally {
      setSubmittingVote(false);
    }
  };

  // If no resolution poll exists for this problem, don't render anything
  if (!poll) {
    return null;
  }

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-md space-y-3.5 transition-all ${
        isVerified
          ? 'ring-1 ring-[var(--success)]/30'
          : isReopened
          ? 'ring-1 ring-[var(--warning)]/30'
          : 'ring-1 ring-[var(--cyan)]/20'
      } ${className}`}
    >
      {/* 1. Header: Ur Queries / Votes count */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-bold text-[var(--text)] tracking-tight">
            Ur Queries
          </h4>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Select one or more
          </p>
        </div>
        <div className="text-xs font-mono font-bold text-[var(--cyan)]">
          {votedCount} / {totalEligible} Votes
        </div>
      </div>

      {/* Verification Outcome Notifications */}
      {voteSuccess && (
        <div className="p-2.5 rounded-xl bg-[var(--success-light)]/25 border border-[var(--success)]/50 text-xs text-[var(--success)] flex items-center gap-2 font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--success)]" />
          <span>{voteSuccess}</span>
        </div>
      )}

      {voteError && (
        <div className="p-2.5 rounded-xl bg-[var(--danger-light)]/25 border border-[var(--danger)]/50 text-xs text-[var(--danger)] flex items-center gap-2 font-medium animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-[var(--danger)]" />
          <span>{voteError}</span>
        </div>
      )}

      {/* 2. Interactive Radio Poll Options (Solved / Partially solved / Not solved) */}
      <div className="space-y-2">
        {/* Option 1: Solved */}
        <div
          onClick={() => isEligibleReporter && isActive && !submittingVote && handleVote('Solved')}
          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
            userVote?.selectedOption === 'Solved'
              ? 'bg-[var(--surface-hover)] border-[var(--primary)] ring-1 ring-[var(--primary)]/40 shadow-xs'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--glass-border)]'
          } ${!isEligibleReporter || !isActive || submittingVote ? 'opacity-85' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                userVote?.selectedOption === 'Solved'
                  ? 'border-[var(--primary)] bg-[var(--primary)]'
                  : 'border-[var(--text-muted)] bg-transparent'
              }`}
            >
              {userVote?.selectedOption === 'Solved' && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>
            <span className="text-sm font-semibold text-[var(--text)]">Solved</span>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {voteStats.counts.Solved} ({voteStats.percentages.Solved}%)
          </span>
        </div>

        {/* Option 2: Partially solved */}
        <div
          onClick={() => isEligibleReporter && isActive && !submittingVote && handleVote('Partially Solved')}
          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
            userVote?.selectedOption === 'Partially Solved'
              ? 'bg-[var(--surface-hover)] border-[var(--warning)] ring-1 ring-[var(--warning)]/40 shadow-xs'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--glass-border)]'
          } ${!isEligibleReporter || !isActive || submittingVote ? 'opacity-85' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                userVote?.selectedOption === 'Partially Solved'
                  ? 'border-[var(--warning)] bg-[var(--warning)]'
                  : 'border-[var(--text-muted)] bg-transparent'
              }`}
            >
              {userVote?.selectedOption === 'Partially Solved' && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>
            <span className="text-sm font-semibold text-[var(--text)]">Partially solved</span>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {voteStats.counts['Partially Solved']} ({voteStats.percentages['Partially Solved']}%)
          </span>
        </div>

        {/* Option 3: Not solved */}
        <div
          onClick={() => isEligibleReporter && isActive && !submittingVote && handleVote('Not Solved')}
          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
            userVote?.selectedOption === 'Not Solved'
              ? 'bg-[var(--surface-hover)] border-[var(--danger)] ring-1 ring-[var(--danger)]/40 shadow-xs'
              : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--glass-border)]'
          } ${!isEligibleReporter || !isActive || submittingVote ? 'opacity-85' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                userVote?.selectedOption === 'Not Solved'
                  ? 'border-[var(--danger)] bg-[var(--danger)]'
                  : 'border-[var(--text-muted)] bg-transparent'
              }`}
            >
              {userVote?.selectedOption === 'Not Solved' && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>
            <span className="text-sm font-semibold text-[var(--text)]">Not solved</span>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {voteStats.counts['Not Solved']} ({voteStats.percentages['Not Solved']}%)
          </span>
        </div>
      </div>

      {/* 3. Security Callout & Voter Notice */}
      <div className="space-y-1 text-xs text-[var(--text-muted)] pt-1 italic">
        <div className="flex items-center gap-1.5">
          <span>🔒</span>
          <span>
            Only the {totalEligible} affected user(s) who reported this query can verify this resolution.
          </span>
        </div>
        {!isEligibleReporter && !isAdmin && (
          <div className="text-[11px] text-[var(--text-muted)] not-italic">
            Only the original reporter(s) recorded for this specific query are eligible to verify the resolution.
          </div>
        )}
      </div>

      {/* 4. Timer & View Votes Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5 font-mono">
          <Clock className="w-3.5 h-3.5 text-[var(--cyan)]" />
          <span>{elapsedText}</span>
        </div>
        <button
          type="button"
          id="view-votes-toggle-btn"
          onClick={() => setShowDetailedVotes(!showDetailedVotes)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            showDetailedVotes
              ? 'bg-[var(--cyan)] text-slate-900 shadow-md font-bold'
              : 'bg-[var(--cyan)]/15 hover:bg-[var(--cyan)]/25 text-[var(--cyan)] border border-[var(--cyan)]/30'
          }`}
        >
          {showDetailedVotes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{showDetailedVotes ? `Hide votes (${votedCount})` : `View votes (${votedCount})`}</span>
        </button>
      </div>

      {/* 5. Strict Unanimous Policy Box */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs space-y-1">
        <div className="font-bold text-[var(--text)]">Strict Unanimous Policy:</div>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          UNSAID requires 100% of affected users to vote "Solved". Even ONE "Partially Solved" or "Not Solved" vote reopens the query and notifies the administration.
        </p>
      </div>

      {/* 6. Detailed Votes Roster & Participation Breakdown (Toggled via "View Votes") */}
      {showDetailedVotes && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] space-y-3 pt-3 animate-fade-in shadow-inner">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold flex-wrap gap-2">
            <span className="flex items-center gap-1.5 text-[var(--text)] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--cyan)]" />
              <span>Voter Participation ({votedCount} of {totalEligible} Voted)</span>
            </span>
            <span className="font-mono text-[11px] text-[var(--cyan)]">
              {totalEligible > 0 ? Math.round((votedCount / totalEligible) * 100) : 0}% Complete {pendingCount > 0 && `· ${pendingCount} pending`}
            </span>
          </div>

          {/* Progress Multi-Bar */}
          <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden flex border border-[var(--glass-border)]">
            <div
              style={{ width: `${voteStats.percentages.Solved || 0}%` }}
              className="bg-[var(--success)] transition-all duration-300"
              title={`Solved: ${voteStats.counts.Solved}`}
            />
            <div
              style={{ width: `${voteStats.percentages['Partially Solved'] || 0}%` }}
              className="bg-[var(--warning)] transition-all duration-300"
              title={`Partially Solved: ${voteStats.counts['Partially Solved']}`}
            />
            <div
              style={{ width: `${voteStats.percentages['Not Solved'] || 0}%` }}
              className="bg-[var(--danger)] transition-all duration-300"
              title={`Not Solved: ${voteStats.counts['Not Solved']}`}
            />
          </div>

          {/* 3 Count Cards: Solved / Partially / Not Solved */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)]">
              <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Solved</div>
              <div className="text-sm sm:text-base font-extrabold text-[var(--success)] mt-0.5">
                {voteStats.counts.Solved} <span className="text-[10px] text-[var(--text-muted)] font-normal">({voteStats.percentages.Solved}%)</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)]">
              <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Partially</div>
              <div className="text-sm sm:text-base font-extrabold text-[var(--warning)] mt-0.5">
                {voteStats.counts['Partially Solved']} <span className="text-[10px] text-[var(--text-muted)] font-normal">({voteStats.percentages['Partially Solved']}%)</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)]">
              <div className="text-[10px] text-[var(--text-muted)] font-semibold uppercase">Not Solved</div>
              <div className="text-sm sm:text-base font-extrabold text-[var(--danger)] mt-0.5">
                {voteStats.counts['Not Solved']} <span className="text-[10px] text-[var(--text-muted)] font-normal">({voteStats.percentages['Not Solved']}%)</span>
              </div>
            </div>
          </div>

          {/* List of Who Voted & Their Choices */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
              <span>Voters Roster ({voteStats.votes.length})</span>
              {pendingCount > 0 && (
                <span className="text-[var(--warning)] lowercase font-mono">
                  {pendingCount} reporter(s) pending
                </span>
              )}
            </div>

            {voteStats.votes.length === 0 ? (
              <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text-muted)] text-center space-y-1">
                <div className="font-semibold text-[var(--text)]">0 Votes Submitted</div>
                <div className="text-[11px]">No one has voted yet. Awaiting responses from {totalEligible} eligible reporter(s).</div>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {voteStats.votes.map((v, i) => (
                  <div
                    key={v.id || i}
                    className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[var(--surface-hover)] border border-[var(--glass-border)] flex items-center justify-center font-bold text-[10px] text-[var(--text)] shrink-0">
                        {(v.userName || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--text)] truncate">
                          {v.userName || 'Recorded Reporter'}
                        </div>
                        {v.userEmail && (
                          <div className="text-[10px] text-[var(--text-muted)] truncate font-mono">
                            {v.userEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={
                          v.selectedOption === 'Solved'
                            ? 'low'
                            : v.selectedOption === 'Partially Solved'
                            ? 'warning'
                            : 'high'
                        }
                        size="xs"
                        className="font-semibold"
                      >
                        {v.selectedOption === 'Solved' ? '✓ Solved' : v.selectedOption}
                      </Badge>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {formatVoteTime(v.updatedAt || v.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rejection / Non-Solved Reporter Details for Admin Attention */}
          {voteStats.rejections.length > 0 && (
            <div className="p-3 rounded-xl bg-[var(--warning-light)]/20 border border-[var(--warning)]/30 text-xs space-y-1.5">
              <div className="font-semibold text-[var(--warning)] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Unresolved Feedback from Reporters:</span>
              </div>
              <div className="space-y-1 pl-1">
                {voteStats.rejections.map((rej, idx) => (
                  <div key={idx} className="text-[11px] text-[var(--text)] flex items-center justify-between">
                    <span className="font-medium">{rej.userName}</span>
                    <Badge variant={rej.selectedOption === 'Partially Solved' ? 'warning' : 'high'} size="xs">
                      {rej.selectedOption}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
