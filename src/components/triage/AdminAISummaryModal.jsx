import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { fetchAdminAISummary } from '../../services/aiResolutionService';

export const AdminAISummaryModal = ({
  isOpen,
  onClose,
  workspace,
  problems = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);
  const loadingRef = useRef(false);
  const problemsRef = useRef(problems);

  useEffect(() => {
    problemsRef.current = problems;
  }, [problems]);

  const loadSummary = useCallback(async () => {
    if (!workspace?.id || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await fetchAdminAISummary({
        workspaceId: workspace.id,
        workspaceName: workspace.name || 'Workspace',
        problems: problemsRef.current || [],
      });

      if (res.success && res.summary) {
        setSummaryData(res.summary);
        setError('');
      } else {
        setError(res.error || 'AI summary is temporarily unavailable.');
      }
    } catch {
      setError('Failed to generate AI summary. You can still triage queries manually.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [workspace?.id, workspace?.name]);

  useEffect(() => {
    if (isOpen && workspace?.id) {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadSummary();
      }
    } else {
      hasLoadedRef.current = false;
      setSummaryData(null);
      setError('');
    }
  }, [isOpen, workspace?.id, loadSummary]);

  if (!isOpen) return null;



  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="UNSAID AI / Triage Summary"
      subtitle={`Executive synthesis of operational issues in "${workspace?.name || 'Workspace'}"`}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Loading State */}
        {loading && (
          <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex flex-col items-center justify-center text-center space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--cyan)] to-[var(--primary)] opacity-25 blur-lg animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[var(--cyan)] animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">Synthesizing Query Data...</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Synthesizing {problems.length} active queries for patterns, bottlenecks, and recommendations.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex flex-col sm:flex-row items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--warning)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-[var(--text)] block">
                  AI Summary Unavailable
                </span>
                <p className="text-[var(--text-muted)] leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={loadSummary}
              className="shrink-0 self-end sm:self-auto"
            >
              Retry
            </Button>
          </div>
        )}


        {/* Successful Summary Data */}
        {!loading && summaryData && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="flex items-center justify-between text-xs pb-1 border-b border-[var(--glass-border)]">
              <span className="font-semibold text-[var(--cyan)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--cyan)]" />
                AI Executive Overview
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {problems.length} queries synthesized
              </span>
            </div>

            {/* 1. Current Situation / Overview */}
            {summaryData.overview && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Current Situation
                </span>
                <p className="text-xs text-[var(--text)] leading-relaxed">
                  {summaryData.overview}
                </p>
              </div>
            )}

            {/* 2. Top Issues */}
            {Array.isArray(summaryData.topIssues) && summaryData.topIssues.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Top Issues & Themes
                </span>
                <div className="space-y-1.5">
                  {summaryData.topIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-[var(--text)] flex items-start gap-2 leading-relaxed"
                    >
                      <span className="w-4 h-4 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Priority Insights */}
            {Array.isArray(summaryData.priorityInsights) && summaryData.priorityInsights.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--warning)] block">
                  Priority Insights
                </span>
                <div className="space-y-1.5">
                  {summaryData.priorityInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-[var(--text-secondary)] flex items-start gap-2 leading-relaxed"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--warning)] shrink-0 mt-0.5" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Recurring Patterns */}
            {Array.isArray(summaryData.recurringPatterns) && summaryData.recurringPatterns.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)] block">
                  Recurring Patterns
                </span>
                <div className="space-y-1.5">
                  {summaryData.recurringPatterns.map((pattern, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-[var(--text-secondary)] flex items-start gap-2 leading-relaxed"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--cyan)] shrink-0 mt-0.5" />
                      <span>{pattern}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Recommended Actions */}
            {Array.isArray(summaryData.recommendedActions) && summaryData.recommendedActions.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--primary)]/20 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] block">
                  Recommended Actions
                </span>
                <div className="space-y-1.5">
                  {summaryData.recommendedActions.map((action, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-[var(--text)] flex items-start gap-2 leading-relaxed font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0 mt-0.5" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <p className="text-[10px] text-[var(--text-muted)] italic pt-1">
              AI recommendations are advisory. Administrators remain responsible for official resolutions and communications.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};
