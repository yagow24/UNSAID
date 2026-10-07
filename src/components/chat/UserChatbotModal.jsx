import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Lightbulb,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { UnsaidLogoMark } from '../ui/UnsaidLogoMark';
import { fetchAIResolution } from '../../services/aiResolutionService';
import { submitProblem } from '../../services/problemService';

const SUGGESTED_PROBLEMS = [
  'My hostel room AC is not working.',
  'Wi-Fi router in the common hall is disconnected.',
  'Water leakage under the washroom sink in room 204.',
];

export const UserChatbotModal = ({
  isOpen,
  onClose,
  workspace,
  userProfile,
  currentUser,
  onProblemSubmitted,
}) => {
  const [problemText, setProblemText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [flowState, setFlowState] = useState('input'); // 'input' | 'solution' | 'resolved' | 'escalated'
  const [errorMessage, setErrorMessage] = useState('');
  const [escalatedTicket, setEscalatedTicket] = useState(null);

  const inputRef = useRef(null);
  const workspaceName = workspace?.name || 'Workspace';

  // Reset or focus on modal open
  useEffect(() => {
    if (isOpen) {
      if (flowState === 'input') {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    } else {
      // Reset state when closed
      setProblemText('');
      setAnalysisResult(null);
      setFlowState('input');
      setErrorMessage('');
      setEscalatedTicket(null);
    }
  }, [isOpen, flowState]);

  // Step 1: Submit problem to REAL Gemini via Flask
  const handleAnalyzeProblem = async (overrideText) => {
    const text = (overrideText || problemText).trim();
    if (!text || analyzing || !workspace?.id) return;

    if (overrideText) {
      setProblemText(overrideText);
    }

    setAnalyzing(true);
    setErrorMessage('');

    try {
      const res = await fetchAIResolution({
        workspaceId: workspace.id,
        title: text.slice(0, 100),
        description: text,
        category: 'General',
      });

      if (res.available && res.analysis) {
        setAnalysisResult(res.analysis);
        setFlowState('solution');
      } else {
        setErrorMessage(res.message || 'AI analysis temporarily unavailable. You can escalate directly.');
      }
    } catch (err) {
      console.warn('[UNSAID User AI Error]', err);
      setErrorMessage('Failed to connect to AI analysis service. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Step 2A: User is SATISFIED ("✓ This solved my problem")
  const handleSolvedLocally = () => {
    setFlowState('resolved');
  };

  // Step 2B: User is NOT SATISFIED ("✕ This didn't solve my problem") -> ESCALATE TO ADMIN
  const handleEscalateToAdmin = async () => {
    if (!workspace?.id || !problemText.trim() || escalating) return;

    setEscalating(true);
    setErrorMessage('');

    try {
      const enrichedAIAnalysis = analysisResult
        ? {
            ...analysisResult,
            userSatisfied: false,
            escalatedFromAI: true,
            userFeedback: "This didn't solve my problem",
          }
        : null;

      const created = await submitProblem({
        workspaceId: workspace.id,
        title: problemText.slice(0, 100),
        description: problemText,
        category: analysisResult?.category || 'General',
        priority: analysisResult?.priority || 'normal',
        workaround: analysisResult?.suggestedWorkaround || '',
        aiAnalysis: enrichedAIAnalysis,
        currentUser,
        userProfile,
        isEmergency: analysisResult?.priority === 'high',
      });

      setEscalatedTicket(created);
      if (onProblemSubmitted) {
        onProblemSubmitted(created);
      }
      setFlowState('escalated');
    } catch (err) {
      console.error('[UNSAID Escalation Error]', err);
      setErrorMessage('Failed to escalate problem to administration. Please try again.');
    } finally {
      setEscalating(false);
    }
  };

  const handleResetForNewQuery = () => {
    setProblemText('');
    setAnalysisResult(null);
    setFlowState('input');
    setErrorMessage('');
    setEscalatedTicket(null);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="UNSAID AI Resolution"
      subtitle={`Instant AI troubleshooting & automated escalation for "${workspaceName}"`}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Top Status Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-sm">
              <UnsaidLogoMark
                size={36}
                animated={true}
                animationMode={analyzing ? 'thinking' : 'dance'}
                showShadow={false}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--text)] text-xs">UNSAID AI Assistant</span>
                <Badge variant="cyan" size="xs" dot>
                  {analyzing ? 'Thinking...' : 'Online'}
                </Badge>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                {analyzing ? 'Analyzing symptoms & formulating solution...' : 'Instant troubleshooting & escalation'}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
            Workspace: {workspaceName}
          </span>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--danger)]/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-[var(--danger)]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => handleAnalyzeProblem()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* VIEW 1: PROBLEM INPUT & ACTIVE THINKING VIEW */}
        {flowState === 'input' && (
          <div className="space-y-4">
            {analyzing ? (
              /* PROMINENT AI THINKING STATE - Bigger Icon & Expressive Cognitive Animation */
              <div className="py-10 px-6 rounded-2xl bg-[var(--surface)] border border-[var(--cyan)]/30 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--cyan)]/10 via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10 p-3.5 rounded-3xl bg-[var(--surface-hover)] border border-[var(--glass-border)] shadow-2xl">
                  <UnsaidLogoMark
                    size={84}
                    animated={true}
                    animationMode="thinking"
                    showShadow={true}
                  />
                </div>

                <div className="space-y-1.5 relative z-10 max-w-sm">
                  <h4 className="text-sm font-bold text-[var(--text)] flex items-center justify-center gap-2">
                    <span>AI is thinking</span>
                    <span className="inline-flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Analyzing "{problemText.slice(0, 60)}{problemText.length > 60 ? '...' : ''}" and preparing practical troubleshooting steps...
                  </p>
                </div>
              </div>
            ) : (
              /* INPUT FORM */
              <>
                <div className="space-y-2">
                  <label htmlFor="user-ai-problem-input" className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
                    Describe your problem or operational issue:
                  </label>
                  <textarea
                    id="user-ai-problem-input"
                    ref={inputRef}
                    value={problemText}
                    onChange={(e) => setProblemText(e.target.value)}
                    placeholder="Example: My hostel room AC is not working."
                    disabled={analyzing}
                    rows={4}
                    className="w-full bg-[var(--surface)] border border-[var(--glass-border)] rounded-2xl p-3.5 text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-all resize-none"
                  />
                </div>

                {/* Quick Suggested Queries */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-[var(--cyan)]" /> Quick Examples
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_PROBLEMS.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAnalyzeProblem(suggestion)}
                        className="px-3 py-1.5 rounded-full text-[11px] bg-[var(--surface)] hover:bg-[var(--primary)]/15 border border-[var(--glass-border)] hover:border-[var(--primary)]/30 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors cursor-pointer text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={!problemText.trim() || analyzing}
                    isLoading={analyzing}
                    icon={analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-[var(--cyan)]" />}
                    onClick={() => handleAnalyzeProblem()}
                  >
                    Get AI Solution
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* VIEW 2: AI SOLUTION & USER DECISION */}
        {flowState === 'solution' && analysisResult && (
          <div className="space-y-4">
            {/* User Problem Recap */}
            <div className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] text-xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                Your Reported Issue
              </span>
              <p className="font-semibold text-[var(--text)]">{problemText}</p>
            </div>

            {/* AI Understanding */}
            {analysisResult.summary && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cyan)] block">
                  AI Understanding
                </span>
                <p className="text-xs text-[var(--text)] leading-relaxed">
                  {analysisResult.summary}
                </p>
              </div>
            )}

            {/* AI Suggested Solution */}
            {analysisResult.suggestedWorkaround && (
              <div className="p-4 rounded-2xl bg-[var(--surface-hover)] border border-[var(--cyan)]/30 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-sm">
                    <UnsaidLogoMark
                      size={28}
                      animated={true}
                      animationMode="dance"
                      showShadow={false}
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text)]">
                      AI Suggested Solution & Troubleshooting
                    </h4>
                    <span className="text-[10px] text-[var(--cyan)] font-medium">
                      Tailored diagnostic resolution
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed pl-1 sm:pl-2">
                  {analysisResult.suggestedWorkaround}
                </p>
              </div>
            )}

            {/* Quick Actions */}
            {Array.isArray(analysisResult.quickActions) && analysisResult.quickActions.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Actionable Steps
                </span>
                <ul className="space-y-1.5">
                  {analysisResult.quickActions.map((action, idx) => (
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

            {/* User Choice Section */}
            <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] space-y-3">
              <div className="text-center space-y-0.5">
                <h4 className="text-xs font-bold text-[var(--text)]">
                  Did this AI solution solve your problem?
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  If this did not work, we will automatically escalate your issue to workspace administrators.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* 1. Solved Option */}
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleSolvedLocally}
                  disabled={escalating}
                  icon={<CheckCircle className="w-4 h-4 text-[var(--success)]" />}
                  className="w-full justify-center"
                >
                  ✓ This solved my problem
                </Button>

                {/* 2. Escalation Option */}
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleEscalateToAdmin}
                  isLoading={escalating}
                  disabled={escalating}
                  icon={<XCircle className="w-4 h-4 text-[var(--danger)]" />}
                  className="w-full justify-center"
                >
                  ✕ This didn't solve my problem
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: RESOLVED LOCALLY */}
        {flowState === 'resolved' && (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--success)]/15 border border-[var(--success)]/30 text-[var(--success)] flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-[var(--text)]">Issue Resolved Instantly</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Glad the AI solution worked! Your problem has been marked as resolved and will not be escalated to the administration.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleResetForNewQuery}>
                Ask Another Question
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* VIEW 4: ESCALATED TO ADMIN */}
        {flowState === 'escalated' && (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] flex items-center justify-center mx-auto">
              <ShieldAlert className="w-9 h-9 text-[var(--cyan)]" />
            </div>
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-[var(--text)]">Escalated to Administrators</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Your ticket has been sent to the workspace administration. Administrators can see your original report along with the AI's attempted resolution.
              </p>
              {escalatedTicket?.id && (
                <div className="pt-1">
                  <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-[var(--surface-hover)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                    Ticket ID: #{escalatedTicket.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleResetForNewQuery}>
                Start New Query
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onClose}>
                View in Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
