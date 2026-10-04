import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Users,
  Bot,
  Clock,
  Bell,
} from 'lucide-react';

import { useWorkspace } from '../hooks/useWorkspace';
import { PageContainer } from '../components/layout/PageContainer';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { GenerateInviteModal } from '../components/workspace/GenerateInviteModal';
import { WorkspaceRequestsModal } from '../components/workspace/WorkspaceRequestsModal';
import { ProblemDetailsModal } from '../components/problem/ProblemDetailsModal';
import { QueryTriageWorkspace } from '../components/triage/QueryTriageWorkspace';
import { OfflineBanner } from '../components/common/OfflineBanner';
import { subscribeToWorkspaceProblems } from '../services/problemService';

/**
 * AdminDashboardShell Page
 * Live administration console for workspace managers.
 * Connects directly to Firestore problems scoped strictly by current workspace ID.
 */
export const AdminDashboardShell = () => {
  const { currentWorkspace, pendingRequests, pendingRequestsCount } = useWorkspace();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);

  // Real-time Firestore workspace problems state
  const [problems, setProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [errorProblems, setErrorProblems] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);

  const wsId = currentWorkspace?.id;

  // Real-time subscription strictly scoped to active workspace
  useEffect(() => {
    let isCancelled = false;

    if (!wsId) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setProblems([]);
          setLoadingProblems(false);
          setErrorProblems(null);
        }
      });
      return;
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setLoadingProblems(true);
        setErrorProblems(null);
      }
    });

    const unsubscribe = subscribeToWorkspaceProblems(
      wsId,
      (data) => {
        if (!isCancelled) {
          setProblems(data);
          setLoadingProblems(false);
          setErrorProblems(null);
        }
      },
      (err) => {
        if (!isCancelled) {
          console.error('[AdminDashboard] Problem subscription error:', err);
          setErrorProblems('Unable to load workspace queries. Please try again.');
          setLoadingProblems(false);
        }
      }
    );

    return () => {
      isCancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [wsId]);

  // Derived real-time metrics for current workspace
  const metrics = useMemo(() => {
    const total = problems.length;
    const emergencyCount = problems.filter(
      (p) => p.isEmergency || p.priority === 'emergency'
    ).length;
    const openCount = problems.filter((p) => p.status === 'open').length;
    const solvedCount = problems.filter((p) => p.status === 'solved').length;
    return { total, emergencyCount, openCount, solvedCount };
  }, [problems]);

  return (
    <>
      <OfflineBanner />
      <PageContainer size="lg" className="space-y-8">
      {/* 1. Header */}
      <SectionHeader
        title="Admin Control Center"
        subtitle={
          currentWorkspace
            ? `Managing: ${currentWorkspace.name} (${currentWorkspace.domain}) · Verified administrator console.`
            : 'No active workspace selected. Select or create a workspace to manage.'
        }
        badge={
          <Badge variant="cyan" size="sm" dot>
            {currentWorkspace ? currentWorkspace.domain : 'Admin Mode'}
          </Badge>
        }
        action={
          <div className="flex items-center gap-2">
            {currentWorkspace && (
              <>
                <Button
                  variant={pendingRequestsCount > 0 ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setRequestsModalOpen(true)}
                  className="flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Join Requests</span>
                  <Badge
                    variant={pendingRequestsCount > 0 ? 'cyan' : 'neutral'}
                    size="sm"
                    className="ml-1 px-1.5 py-0 text-[10px]"
                  >
                    {pendingRequestsCount}
                  </Badge>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setInviteModalOpen(true)}
                >
                  Generate Invite Link
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Real-time Join Requests Alert Banner for Admin */}
      {pendingRequestsCount > 0 && (
        <GlassCard
          variant="panel"
          className="p-4 sm:p-5 border-l-4 border-l-[var(--cyan)] bg-[var(--surface-hover)] shadow-md animate-fade-in"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[var(--cyan-light)] text-[var(--cyan)] border border-[var(--cyan)]/30 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text)]">
                    {pendingRequestsCount} New Workspace Join {pendingRequestsCount === 1 ? 'Request' : 'Requests'}
                  </span>
                  <Badge variant="cyan" size="sm" dot>
                    Action Required
                  </Badge>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  <strong>{pendingRequests[0]?.userName || 'User'}</strong> ({pendingRequests[0]?.userEmail}) requested to join <strong>{currentWorkspace?.name}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setRequestsModalOpen(true)}
              >
                Review Requests
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 2. Admin Live Analytics Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <GlassCard glow className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Escalation Queue</span>
            <ShieldAlert className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems ? '--' : metrics.emergencyCount}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics.emergencyCount > 0
              ? `${metrics.emergencyCount} emergency ${metrics.emergencyCount === 1 ? 'alert' : 'alerts'} pending`
              : 'Zero active emergency alerts'}
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Resolved Queries</span>
            <Clock className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems ? '--' : metrics.solvedCount}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics.solvedCount} resolved of {metrics.total} total
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>AI Summaries Generated</span>
            <Bot className="w-4 h-4 text-[var(--cyan)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">--</div>
          <p className="text-xs text-[var(--text-muted)]">
            Gemini Flash integration in Part 5
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Total Queries</span>
            <Users className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems ? '--' : metrics.total}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics.openCount} open · {metrics.solvedCount} solved
          </p>
        </GlassCard>
      </section>

      {/* 3. Triage Workspace */}
      <section className="space-y-4">
        <QueryTriageWorkspace
          problems={problems}
          loading={loadingProblems}
          error={errorProblems}
          workspace={currentWorkspace}
          onProblemUpdated={(updated) => {
            setProblems((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
          }}
        />
      </section>

      {/* Admin Modals */}
      <GenerateInviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        workspace={currentWorkspace}
      />

      <WorkspaceRequestsModal
        isOpen={requestsModalOpen}
        onClose={() => setRequestsModalOpen(false)}
        workspace={currentWorkspace}
      />

      <ProblemDetailsModal
        isOpen={Boolean(selectedProblem)}
        onClose={() => setSelectedProblem(null)}
        problem={selectedProblem}
        workspace={currentWorkspace}
        allWorkspaceProblems={problems}
        onStatusChanged={(probId, nextStatus) => {
          setProblems((prev) =>
            prev.map((p) => (p.id === probId ? { ...p, status: nextStatus } : p))
          );
          if (selectedProblem?.id === probId) {
            setSelectedProblem((prev) => (prev ? { ...prev, status: nextStatus } : null));
          }
        }}
        onProblemUpdated={(updated) => {
          setProblems((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
          setSelectedProblem(updated);
        }}
      />
    </PageContainer>
    </>
  );
};
