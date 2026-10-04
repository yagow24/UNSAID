import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  ArrowRight,
  HelpCircle,
  FileText,
  Tag,
  Shield,
  Loader2,
  Edit3,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { fetchAIResolution } from '../../services/aiResolutionService';

export const PreSubmitAIModal = ({
  isOpen,
  onClose,
  onBackToEdit,
  onSatisfied,
  onPublish,
  submitting = false,
  problemDraft,
}) => {
  const [resolutionState, setResolutionState] = useState(null);
  const [resolvedKey, setResolvedKey] = useState(null);

  const currentKey =
    isOpen && problemDraft
      ? `${problemDraft.workspaceId || ''}_${problemDraft.title || ''}_${problemDraft.category || ''}`
      : null;

  useEffect(() => {
    let active = true;

    if (isOpen && problemDraft && currentKey && resolvedKey !== currentKey) {
      fetchAIResolution({
        workspaceId: problemDraft.workspaceId,
        title: problemDraft.title,
        description: problemDraft.description,
        category: problemDraft.category,
        subIssue: problemDraft.subIssue,
        workaround: problemDraft.workaround,
        isEmergency: problemDraft.isEmergency,
      })
        .then((result) => {
          if (active) {
            setResolutionState(result);
            setResolvedKey(currentKey);
          }
        })
        .catch(() => {
          if (active) {
            setResolutionState({
              available: false,
              message: 'AI suggestions are currently unavailable. You can still publish your problem.',
              suggestions: [],
            });
            setResolvedKey(currentKey);
          }
        });
    }

    return () => {
      active = false;
    };
  }, [isOpen, problemDraft, currentKey, resolvedKey]);

  if (!isOpen || !problemDraft) return null;

  const loading = resolvedKey !== currentKey;

  const hasSuggestions =
    resolutionState?.available &&
    Array.isArray(resolutionState.suggestions) &&
    resolutionState.suggestions.length > 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Pre-Submit Knowledge Resolution"
      subtitle="Check if existing solutions can resolve your query instantly before publishing."
      maxWidth="lg"
    >
      <div className="space-y-5 pt-1">
        {/* Loading State */}
        {loading && (
          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[var(--cyan)] animate-spin" />
            <div>
              <p className="text-xs font-semibold text-[var(--text)]">Checking Knowledge Base...</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Connecting to authorized assistance service to find relevant fixes.
              </p>
            </div>
          </div>
        )}

        {/* Real AI Suggestions Available */}
        {!loading && hasSuggestions && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--cyan)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--cyan)]" />
                Suggested Instant Solutions
              </span>
              {resolutionState.confidence !== null && (
                <Badge variant="cyan" size="sm">
                  {Math.round(resolutionState.confidence * 100)}% match
                </Badge>
              )}
            </div>

            {resolutionState.summary && (
              <p className="text-xs text-[var(--text-muted)] bg-[var(--surface)] p-3 rounded-xl border border-[var(--glass-border)]">
                {resolutionState.summary}
              </p>
            )}

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {resolutionState.suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2"
                >
                  <h4 className="text-xs font-bold text-[var(--text)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    {sug.title}
                  </h4>
                  {Array.isArray(sug.steps) && sug.steps.length > 0 && (
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-[var(--text-secondary)] pl-1">
                      {sug.steps.map((step, sIdx) => (
                        <li key={sIdx} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Truthful AI Unavailable Notice (No Mock Data) */}
        {!loading && !hasSuggestions && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-[var(--text-muted)] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-[var(--text)] block">
                Direct Publication Ready
              </span>
              <p className="text-[var(--text-muted)] leading-relaxed">
                {resolutionState?.message ||
                  'AI suggestions are currently unavailable. You can proceed directly to publish your problem to the workspace.'}
              </p>
            </div>
          </div>
        )}

        {/* Query Preview Section */}
        <div className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
              Submission Preview
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={onBackToEdit}
              disabled={submitting}
              className="text-[11px] h-7"
            >
              Edit
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Title
              </span>
              <p className="font-semibold text-[var(--text)]">{problemDraft.title}</p>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="neutral" size="sm" icon={<Tag className="w-3 h-3" />}>
                {problemDraft.category}
              </Badge>
              {problemDraft.subIssue && (
                <Badge variant="cyan" size="sm">
                  {problemDraft.subIssue}
                </Badge>
              )}
              {problemDraft.isEmergency && (
                <Badge variant="danger" size="sm">
                  Emergency
                </Badge>
              )}
              <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 ml-auto">
                <Shield className="w-3 h-3 text-[var(--cyan)]" />
                Posting as:{' '}
                <strong className={problemDraft.isAnonPost ? 'text-[var(--cyan)] font-mono' : 'text-[var(--text)]'}>
                  {problemDraft.isAnonPost ? problemDraft.pseudonym : problemDraft.displayName}
                </strong>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                Description
              </span>
              <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed line-clamp-3">
                {problemDraft.description}
              </p>
            </div>

            {problemDraft.workaround && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] block">
                  Proposed Workaround
                </span>
                <p className="text-[var(--text-secondary)] italic">{problemDraft.workaround}</p>
              </div>
            )}

            {problemDraft.imagePreviewUrl && (
              <div className="flex items-center gap-2 pt-1">
                <img
                  src={problemDraft.imagePreviewUrl}
                  alt="Attachment Preview"
                  className="w-12 h-12 rounded-xl object-cover border border-[var(--glass-border)]"
                />
                <span className="text-[11px] text-[var(--text-muted)]">Photo attachment ready for upload</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--glass-border)]">
          {hasSuggestions ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onSatisfied}
                disabled={submitting}
                icon={<CheckCircle className="w-4 h-4 text-[var(--success)]" />}
                className="w-full sm:w-auto"
              >
                Satisfied — Resolve Without Posting
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onPublish}
                isLoading={submitting}
                disabled={submitting}
                icon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Not Satisfied — Publish Problem
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBackToEdit}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Back to Edit
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={onPublish}
                isLoading={submitting}
                disabled={submitting}
                icon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Publish Problem
              </Button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
};
