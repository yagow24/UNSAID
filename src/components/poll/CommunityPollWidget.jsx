import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Lock,
  Plus,
  Vote,
  AlertCircle,
} from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  subscribeToProblemPoll,
  subscribeToPollResponses,
  submitPollVote,
  createProblemPoll,
  closeProblemPoll,
  reopenProblemPoll,
} from '../../services/pollService';

/**
 * CommunityPollWidget Component
 * Real-time problem-specific community poll with live percentage calculation,
 * single-vote enforcement, option updating, and administrator controls.
 */
export const CommunityPollWidget = ({
  problemId,
  workspaceId,
  currentUser,
  userProfile,
  isAdmin = false,
}) => {
  const [poll, setPoll] = useState(null);
  const [pollResponsesData, setPollResponsesData] = useState({
    responses: [],
    counts: {},
    percentages: {},
    totalVotes: 0,
  });
  const [loadingPoll, setLoadingPoll] = useState(true);
  const [selectedOption, setSelectedOption] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  const [isChangingVote, setIsChangingVote] = useState(false);
  const [voteError, setVoteError] = useState('');

  // Admin Poll Creation State
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newQuestion, setNewQuestion] = useState('Is this issue affecting you too?');
  const [option1, setOption1] = useState('Yes');
  const [option2, setOption2] = useState('No');
  const [creationError, setCreationError] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  // 1. Subscribe to Problem Poll in real time
  useEffect(() => {
    let ignore = false;
    if (!problemId) {
      queueMicrotask(() => {
        if (!ignore) {
          setPoll(null);
          setLoadingPoll(false);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!ignore) setLoadingPoll(true);
    });
    const unsubPoll = subscribeToProblemPoll(
      problemId,
      (data) => {
        if (!ignore) {
          setPoll(data);
          setLoadingPoll(false);
        }
      },
      (err) => {
        if (!ignore) {
          console.warn('[UNSAID Poll Listener Error]', err);
          setLoadingPoll(false);
        }
      }
    );

    return () => {
      ignore = true;
      if (typeof unsubPoll === 'function') unsubPoll();
    };
  }, [problemId]);

  // 2. Subscribe to Poll Responses in real time
  useEffect(() => {
    let ignore = false;
    if (!problemId) {
      queueMicrotask(() => {
        if (!ignore) {
          setPollResponsesData({ responses: [], counts: {}, percentages: {}, totalVotes: 0 });
        }
      });
      return;
    }

    const unsubResponses = subscribeToPollResponses(
      problemId,
      (data) => {
        if (!ignore) {
          setPollResponsesData(data);
        }
      },
      (err) => {
        if (!ignore) {
          console.warn('[UNSAID Poll Responses Error]', err);
        }
      }
    );

    return () => {
      ignore = true;
      if (typeof unsubResponses === 'function') unsubResponses();
    };
  }, [problemId]);

  // Determine current user's existing vote
  const myVote = pollResponsesData.responses.find(
    (r) => r.userId === currentUser?.uid
  )?.selectedOption;

  // Handle Vote Submission
  const handleVote = async (e) => {
    e.preventDefault();
    if (!selectedOption || submittingVote || !currentUser?.uid) return;

    setVoteError('');
    setSubmittingVote(true);

    try {
      await submitPollVote({
        problemId,
        workspaceId,
        selectedOption,
        currentUser,
        userProfile,
      });
      setIsChangingVote(false);
    } catch (err) {
      console.error('[UNSAID Poll Vote Error]', err);
      setVoteError(err?.message || "Couldn't record your vote. Please try again.");
    } finally {
      setSubmittingVote(false);
    }
  };

  // Handle Admin Poll Creation
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    setCreationError('');

    if (!newQuestion.trim()) {
      setCreationError('Please enter a question for the poll.');
      return;
    }
    if (!option1.trim() || !option2.trim()) {
      setCreationError('Please provide at least two options.');
      return;
    }

    setCreatingLoading(true);
    try {
      await createProblemPoll({
        problemId,
        workspaceId,
        question: newQuestion.trim(),
        options: [option1.trim(), option2.trim()],
        currentUser,
        userProfile,
      });
      setIsCreatingPoll(false);
      setSelectedOption('');
    } catch (err) {
      console.error('[UNSAID Create Poll Error]', err);
      setCreationError(err?.message || 'Failed to create poll.');
    } finally {
      setCreatingLoading(false);
    }
  };

  // Handle Admin Toggle Poll Status
  const handleTogglePollStatus = async () => {
    if (!poll?.id) return;
    try {
      if (poll.status === 'closed') {
        await reopenProblemPoll(poll.id);
      } else {
        await closeProblemPoll(poll.id);
      }
    } catch (err) {
      console.error('[UNSAID Poll Status Toggle Error]', err);
    }
  };

  if (loadingPoll) {
    return (
      <GlassCard className="p-6 text-center text-xs text-[var(--text-muted)] space-y-2">
        <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading community poll...</p>
      </GlassCard>
    );
  }

  // 1. No Poll Exists Yet State
  if (!poll) {
    return (
      <GlassCard className="p-6 sm:p-7 text-center space-y-4 border border-[var(--glass-border)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[var(--text)]">No Community Poll</h4>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            No community poll has been initiated for this query yet.
          </p>
        </div>

        {isAdmin && !isCreatingPoll && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreatingPoll(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Create Community Poll
          </Button>
        )}

        {/* Admin Poll Creation Form */}
        {isAdmin && isCreatingPoll && (
          <form onSubmit={handleCreatePoll} className="text-left space-y-3 pt-3 border-t border-[var(--glass-border)] max-w-md mx-auto animate-fade-in">
            {creationError && (
              <div className="p-2.5 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{creationError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Poll Question
              </label>
              <input
                type="text"
                required
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Is this issue affecting you too?"
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Option 1
                </label>
                <input
                  type="text"
                  required
                  value={option1}
                  onChange={(e) => setOption1(e.target.value)}
                  placeholder="Yes"
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Option 2
                </label>
                <input
                  type="text"
                  required
                  value={option2}
                  onChange={(e) => setOption2(e.target.value)}
                  placeholder="No"
                  className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={creatingLoading}
              >
                Publish Poll
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreatingPoll(false);
                  setCreationError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </GlassCard>
    );
  }

  const isClosed = poll.status === 'closed';
  const hasVoted = Boolean(myVote) && !isChangingVote;

  return (
    <GlassCard variant="panel" className="p-5 sm:p-6 space-y-5 border border-[var(--glass-border)]">
      {/* Poll Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--cyan)]">
              Community Poll
            </span>
            <Badge variant={isClosed ? 'neutral' : 'cyan'} size="sm">
              {isClosed ? 'Closed' : 'Active Poll'}
            </Badge>
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-[var(--text)]">
            {poll.question}
          </h3>
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="secondary"
              size="xs"
              onClick={handleTogglePollStatus}
              title={isClosed ? 'Reopen poll' : 'Close poll'}
            >
              {isClosed ? 'Reopen' : 'Close Poll'}
            </Button>
          </div>
        )}
      </div>

      {voteError && (
        <div className="p-3 rounded-xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{voteError}</span>
        </div>
      )}

      {/* 2. Poll Results View (Shown if user has voted or if poll is closed) */}
      {hasVoted || (isClosed && !myVote) ? (
        <div className="space-y-3 animate-fade-in">
          <div className="space-y-2.5">
            {poll.options.map((option) => {
              const count = pollResponsesData.counts[option] || 0;
              const pct = pollResponsesData.percentages[option] || 0;
              const isMyChoice = myVote === option;

              return (
                <div key={option} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text)] flex items-center gap-1.5">
                      {isMyChoice && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      )}
                      <span>{option}</span>
                      {isMyChoice && (
                        <span className="text-[10px] text-[var(--primary)] font-semibold">(Your vote)</span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-secondary)] font-semibold">
                      {count} ({pct}%)
                    </span>
                  </div>

                  {/* Liquid Glass Progress Bar */}
                  <div className="h-3 w-full rounded-full bg-[var(--surface-hover)] overflow-hidden p-0.5 border border-[var(--glass-border)]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isMyChoice
                          ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--cyan)] shadow-sm'
                          : 'bg-gradient-to-r from-slate-400 to-slate-500 opacity-60'
                      }`}
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Metadata & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--glass-border)] text-[11px] text-[var(--text-muted)]">
            <span>
              Total: <strong>{pollResponsesData.totalVotes}</strong> {pollResponsesData.totalVotes === 1 ? 'vote' : 'votes'}
            </span>

            {!isClosed && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOption(myVote || poll.options[0]);
                  setIsChangingVote(true);
                }}
                className="text-[var(--primary)] hover:underline font-semibold cursor-pointer"
              >
                Change vote
              </button>
            )}

            {isClosed && (
              <span className="flex items-center gap-1 text-[var(--text-muted)] italic">
                <Lock className="w-3 h-3" />
                Voting is closed
              </span>
            )}
          </div>
        </div>
      ) : (
        /* 3. Voting Form (Shown when user has not voted yet or is changing vote) */
        <form onSubmit={handleVote} className="space-y-4 animate-fade-in">
          <div className="space-y-2">
            {poll.options.map((option) => {
              const isChecked = selectedOption === option;
              return (
                <label
                  key={option}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--text)] font-semibold shadow-sm'
                      : 'bg-[var(--surface)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name={`poll-${poll.id}`}
                      value={option}
                      checked={isChecked}
                      onChange={() => setSelectedOption(option)}
                      className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)]"
                    />
                    <span className="text-xs sm:text-sm">{option}</span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!selectedOption}
              isLoading={submittingVote}
              icon={<Vote className="w-4 h-4" />}
            >
              Submit Vote
            </Button>

            {isChangingVote && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setIsChangingVote(false)}
              >
                Cancel
              </Button>
            )}

            <span className="text-[11px] text-[var(--text-muted)] ml-auto">
              {pollResponsesData.totalVotes} {pollResponsesData.totalVotes === 1 ? 'community vote' : 'community votes'}
            </span>
          </div>
        </form>
      )}
    </GlassCard>
  );
};

export default CommunityPollWidget;
