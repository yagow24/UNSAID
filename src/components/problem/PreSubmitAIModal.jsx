import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  ArrowRight,
  HelpCircle,
  FileText,
  Tag,
  Loader2,
  Edit3,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  UserCheck,
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
  candidateProblems = [],
}) => {
  const [resolutionState, setResolutionState] = useState(null);
  const [resolvedKey, setResolvedKey] = useState(null);

  const currentKey =
    isOpen && problemDraft
      ? `${problemDraft.workspaceId || ''}_${problemDraft.title || ''}_${problemDraft.category || ''}`
      : null;

  const triggerFetch = React.useCallback(() => {
    if (!problemDraft || !problemDraft.workspaceId) return;

    fetchAIResolution({
      workspaceId: problemDraft.workspaceId,
      title: problemDraft.title,
      description: problemDraft.description,
      category: problemDraft.category,
      subIssue: problemDraft.subIssue,
      workaround: problemDraft.workaround,
      isEmergency: problemDraft.isEmergency,
      candidateProblems: candidateProblems || [],
    })
      .then((result) => {
        setResolutionState(result);
        setResolvedKey(currentKey);
      })
      .catch((err) => {
        setResolutionState({
          available: false,
          message: err?.message || 'AI is temporarily unavailable. You can still submit your problem.',
          analysis: null,
        });
        setResolvedKey(currentKey);
      });
  }, [problemDraft, currentKey, candidateProblems]);


  useEffect(() => {
    if (isOpen && problemDraft && currentKey && resolvedKey !== currentKey) {
      triggerFetch();
    }
  }, [isOpen, problemDraft, currentKey, resolvedKey, triggerFetch]);


  if (!isOpen || !problemDraft) return null;

  const loading = resolvedKey !== currentKey;
  const analysis = resolutionState?.analysis;
  const isAvailable = Boolean(resolutionState?.available && analysis);

  const handlePublishWithAI = () => {
    if (onPublish) {
      const enrichedAnalysis = analysis
        ? {
            ...analysis,
            userSatisfied: false,
            escalatedFromAI: true,
            userFeedback: "This didn't solve my problem",
          }
        : null;
      onPublish(enrichedAnalysis);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="UNSAID AI"
      subtitle="Intelligent resolution & triage assistance before publishing."
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Loading State */}
        {loading && (
          <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--cyan)] to-[var(--primary)] opacity-20 blur-md animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--cyan)] animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Analyzing Problem...</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Analyzing query to generate immediate workarounds and triage priority.
              </p>
            </div>
          </div>
        )}

        {/* AI Analysis Available */}
        {!loading && isAvailable && (
          <div className="space-y-4">
            {/* Header Status & Confidence */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[var(--cyan)]/15 text-[var(--cyan)] flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-[var(--text)] tracking-tight">
                  Automated Pre-Submit Assessment
                </span>
              </div>
              <div className="flex items-center gap-2">
                {analysis.confidence && (
                  <Badge variant="cyan" size="sm">
                    {Math.round(analysis.confidence * 100)}% confidence
                  </Badge>
                )}
                <Badge variant="neutral" size="sm">
                  AI Analysis
                </Badge>
              </div>
            </div>

            {/* 1. AI Understanding */}
            {analysis.summary && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)] block">
                  AI Understanding
                </span>
                <p className="text-xs text-[var(--text)] leading-relaxed">
                  {analysis.summary}
                </p>
              </div>
            )}

            {/* 2. Suggested Solution / Workaround */}
            {analysis.suggestedWorkaround && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--cyan)]/25 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                  <Lightbulb className="w-4 h-4 text-[var(--cyan)] shrink-0" />
                  <span>Suggested Solution</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed pl-5">
                  {analysis.suggestedWorkaround}
                </p>
              </div>
            )}

            {/* 3. Quick Actions */}
            {Array.isArray(analysis.quickActions) && analysis.quickActions.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Quick Actions
                </span>
                <ul className="space-y-1.5">
                  {analysis.quickActions.map((action, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-[var(--text-secondary)] flex items-start gap-2 leading-relaxed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 4. Priority & Human Attention Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Priority Recommendation */}
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                    AI Assessed Priority
                  </span>
                  <span className="text-xs font-semibold text-[var(--text)] mt-0.5 block">
                    {analysis.priority ? analysis.priority.toUpperCase() : 'NORMAL'}
                  </span>
                </div>
                <Badge
                  variant={
                    analysis.priority === 'high'
                      ? 'high'
                      : analysis.priority === 'low'
                      ? 'low'
                      : 'medium'
                  }
                  size="sm"
                >
                  {analysis.priority ? analysis.priority.toUpperCase() : 'NORMAL'}
                </Badge>
              </div>

              {/* Human Attention Status */}
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">
                    Human Attention
                  </span>
                  <span className="text-xs font-semibold text-[var(--text)] mt-0.5 block">
                    {analysis.needsHumanAttention ? 'Required' : 'Not Immediately Required'}
                  </span>
                </div>
                <Badge
                  variant={analysis.needsHumanAttention ? 'warning' : 'low'}
                  size="sm"
                  icon={<UserCheck className="w-3 h-3" />}
                >
                  {analysis.needsHumanAttention ? 'Staff Action' : 'Self-Service'}
                </Badge>
              </div>
            </div>

            {/* 5. Similar Problem Detected Alert */}
            {analysis.hasSimilarProblem && Array.isArray(analysis.similarProblems) && analysis.similarProblems.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--warning-light)]/40 border border-[var(--warning)]/30 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />
                  <span>Existing Similar Query Detected in Workspace</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Another member recently reported a similar problem. Check before creating a duplicate ticket:
                </p>
                <div className="space-y-1 pl-1">
                  {analysis.similarProblems.map((sp, idx) => (
                    <div key={idx} className="text-xs text-[var(--text)] flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        #{sp.problemId?.slice(-6).toUpperCase()}
                      </span>
                      <span className="font-medium">{sp.title || sp.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Truthful AI Unavailable Notice */}
        {!loading && !isAvailable && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-[var(--cyan)] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-[var(--text)] block">
                Direct Submission Ready
              </span>
              <p className="text-[var(--text-muted)] leading-relaxed">
                {resolutionState?.message ||
                  'AI is temporarily unavailable. You can still submit your problem to the workspace.'}
              </p>
            </div>
          </div>
        )}

        {/* Query Preview Section */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
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
              className="text-[11px] h-6 px-2"
            >
              Edit
            </Button>
          </div>

          <div className="space-y-1.5 text-xs">
            <p className="font-semibold text-[var(--text)]">{problemDraft.title}</p>
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
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed line-clamp-2">
              {problemDraft.description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--glass-border)]">
          {isAvailable ? (
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
                ✓ This solved my problem
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handlePublishWithAI}
                isLoading={submitting}
                disabled={submitting}
                icon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                ✕ This didn't solve my problem
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
                onClick={handlePublishWithAI}
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
