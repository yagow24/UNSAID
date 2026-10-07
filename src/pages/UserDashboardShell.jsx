import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  History,
  RefreshCw,
  Building2,
  XCircle,
  Sparkles,
} from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNotifications } from '../hooks/useNotifications';

import { PageContainer } from '../components/layout/PageContainer';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SectionHeader } from '../components/ui/SectionHeader';
import { RealtimeClock } from '../components/common/RealtimeClock';
import { IdentityToggle } from '../components/common/IdentityToggle';
import { DailyCheckInWidget } from '../components/checkin/DailyCheckInWidget';
import { ProblemFeed } from '../components/problem/ProblemFeed';
import { SubmitProblemModal } from '../components/problem/SubmitProblemModal';
import { WorkspaceHistoryModal } from '../components/history/WorkspaceHistoryModal';
import { UserChatbotModal } from '../components/chat/UserChatbotModal';
import { UnsaidLogoMark } from '../components/ui/UnsaidLogoMark';
import { OfflineBanner } from '../components/common/OfflineBanner';
import { getShiftStatus } from '../config/shiftConfig';
import { getWorkspaceProblems, subscribeToWorkspaceProblems } from '../services/problemService';
import { syncDailySnapshotFromMetrics } from '../services/historyService';

export const UserDashboardShell = () => {
  const { userProfile, currentUser } = useAuth();
  const { currentWorkspace, switchWorkspace } = useWorkspace();
  const { notifications, markAsRead } = useNotifications();

  const [problems, setProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportIsEmergency, setReportIsEmergency] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const greetingName =
    userProfile?.fullName ||
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'Member');

  const wsId = currentWorkspace?.id;

  // Load problems strictly scoped to active workspace
  const loadProblems = useCallback(async () => {
    if (!wsId) {
      setProblems([]);
      return;
    }
    setLoadingProblems(true);
    try {
      const data = await getWorkspaceProblems(wsId);
      setProblems(data);
    } catch (err) {
      console.error('[UNSAID Load Problems Error]', err);
    } finally {
      setLoadingProblems(false);
    }
  }, [wsId]);

  useEffect(() => {
    let ignore = false;
    if (!wsId) {
      queueMicrotask(() => {
        if (!ignore) setProblems([]);
      });
      return;
    }

    queueMicrotask(() => {
      if (!ignore) setLoadingProblems(true);
    });

    const unsubscribe = subscribeToWorkspaceProblems(
      wsId,
      (data) => {
        if (!ignore) {
          setProblems(data);
          setLoadingProblems(false);
        }
      },
      (err) => {
        if (!ignore) {
          console.error('[UNSAID Load Problems Error]', err);
          setLoadingProblems(false);
        }
      }
    );

    return () => {
      ignore = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [wsId]);

  // Derived metrics from workspace problems
  const metrics = useMemo(() => {
    const total = problems.length;
    const openCount = problems.filter((p) => p.status === 'open').length;
    const emergencyCount = problems.filter((p) => p.isEmergency).length;
    const solvedCount = problems.filter((p) => p.status === 'solved').length;
    return { total, openCount, emergencyCount, solvedCount };
  }, [problems]);

  // Synchronize 10-day rolling daily snapshot for active workspace
  useEffect(() => {
    if (!wsId || loadingProblems) return;
    syncDailySnapshotFromMetrics({ workspaceId: wsId, problems }).catch(() => {});
  }, [wsId, problems, loadingProblems]);

  const shiftStatus = useMemo(() => {
    return getShiftStatus(currentWorkspace?.shiftConfig);
  }, [currentWorkspace?.shiftConfig]);

  const handleOpenNormalReport = () => {
    setReportIsEmergency(false);
    setReportModalOpen(true);
  };

  const handleOpenEmergencyReport = () => {
    setReportIsEmergency(true);
    setReportModalOpen(true);
  };

  const handleProblemSubmitted = (newProblem) => {
    setProblems((prev) => [newProblem, ...prev]);
  };

  const latestRequestNotif = useMemo(() => {
    return notifications.find(
      (n) => !n.read && (n.type === 'request_approved' || n.type === 'request_rejected')
    );
  }, [notifications]);

  return (
    <>
      <OfflineBanner />
      <PageContainer size="lg" className="space-y-8">
      {/* 1. Header with dynamic workspace context and Live Clock */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <SectionHeader
            title={`Welcome back, ${greetingName}`}
            subtitle={
              currentWorkspace
                ? `Active Workspace: ${currentWorkspace.name} (${currentWorkspace.domain || 'community'}) · Query Resolution Core`
                : 'No active workspace selected. Select or join an approved workspace to report queries.'
            }
            badge={
              <Badge variant="cyan" size="sm" dot>
                {currentWorkspace ? currentWorkspace.domain : 'Unassigned'}
              </Badge>
            }
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setChatbotOpen(true)}
                  disabled={!currentWorkspace}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-hover)] hover:bg-[var(--primary)]/15 border border-[var(--glass-border)] hover:border-[var(--primary)]/40 text-xs font-semibold text-[var(--text)] transition-all cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  title="Open UNSAID AI Assistant"
                >
                  <UnsaidLogoMark size={20} animated={true} showShadow={false} />
                  <span>AI Assistant</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<History className="w-4 h-4" />}
                  onClick={() => setHistoryModalOpen(true)}
                  disabled={!currentWorkspace}
                >
                  Archive
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  onClick={handleOpenEmergencyReport}
                  disabled={!currentWorkspace}
                >
                  Emergency
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenNormalReport}
                  disabled={!currentWorkspace}
                >
                  Report Problem
                </Button>
              </div>
            }
          />
          {currentUser?.email && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] pt-0.5 pl-1">
              <span>Logged in as:</span>
              <span className="font-semibold text-[var(--text)]">{currentUser.email}</span>
            </div>
          )}
        </div>

        {/* Real-time Workspace Join Request Notification Banner */}
        {latestRequestNotif && (
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all ${
              latestRequestNotif.type === 'request_approved'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl mt-0.5 ${
                latestRequestNotif.type === 'request_approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {latestRequestNotif.type === 'request_approved' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="font-semibold text-sm text-[var(--text)] flex items-center gap-2">
                  <span>{latestRequestNotif.title}</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    latestRequestNotif.type === 'request_approved'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {latestRequestNotif.type === 'request_approved' ? 'Approved' : 'Declined'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{latestRequestNotif.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {latestRequestNotif.type === 'request_approved' && latestRequestNotif.workspaceId && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    await markAsRead(latestRequestNotif.id);
                    if (switchWorkspace) {
                      await switchWorkspace(latestRequestNotif.workspaceId);
                    }
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg"
                >
                  Switch to Workspace
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAsRead(latestRequestNotif.id)}
                className="text-xs text-[var(--text-muted)] hover:text-white"
                title="Dismiss notification"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Live Clock & Shift Lifecycle Bar */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <RealtimeClock showDate={true} />
            <span className="text-[var(--text-muted)] hidden md:inline">•</span>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Shift:</span>
              <Badge variant={shiftStatus.isShiftActive ? 'low' : 'neutral'} size="sm" dot>
                {shiftStatus.shiftText} · {shiftStatus.nextShiftText}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-between sm:justify-end">
            <IdentityToggle compact={false} />
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] border-l border-[var(--glass-border)] pl-3">
              <button
                type="button"
                onClick={loadProblems}
                disabled={loadingProblems}
                className="text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                title="Refresh problem feed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProblems ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Responsive Metrics Overview (Calculated from active workspace problems) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <GlassCard className="space-y-1.5 p-4 sm:p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Total Queries</span>
            <FileText className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems || !currentWorkspace ? '--' : metrics.total}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">Workspace queries submitted</div>
        </GlassCard>

        <GlassCard className="space-y-1.5 p-4 sm:p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Active / Open</span>
            <Clock className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text)]">
            {loadingProblems || !currentWorkspace ? '--' : metrics.openCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">Under review or resolution</div>
        </GlassCard>

        <GlassCard className="space-y-1.5 p-4 sm:p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Emergencies</span>
            <AlertTriangle className="w-4 h-4 text-[var(--danger)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--danger)]">
            {loadingProblems || !currentWorkspace ? '--' : metrics.emergencyCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">High-priority escalations</div>
        </GlassCard>

        <GlassCard className="space-y-1.5 p-4 sm:p-5">
          <div className="flex items-center justify-between text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
            <span>Resolved</span>
            <CheckCircle className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--success)]">
            {loadingProblems || !currentWorkspace ? '--' : metrics.solvedCount}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">Verified fixes in workspace</div>
        </GlassCard>
      </section>

      {/* 3. Daily Pulse Check-in Widget */}
      {currentWorkspace && (
        <DailyCheckInWidget
          workspace={currentWorkspace}
          currentUser={currentUser}
          userProfile={userProfile}
        />
      )}

      {/* No Approved Workspace Empty State */}
      {!currentWorkspace && (
        <GlassCard variant="panel" className="p-8 text-center space-y-4 border border-[var(--glass-border)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <Building2 className="w-7 h-7 text-[var(--primary)]" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-[var(--text)]">No Approved Workspaces</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              You are not currently a member of any approved workspace. Join an existing workspace with an invite link or ask your workspace administrator for access.
            </p>
          </div>
          <div className="pt-1">
            <Link to="/workspace">
              <Button variant="primary" size="sm">
                Explore Workspaces
              </Button>
            </Link>
          </div>
        </GlassCard>
      )}

      {/* 4. Live Workspace Problem Stream */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <span>Workspace Problem Stream</span>
              <Badge variant="cyan" size="sm">
                Live Feed
              </Badge>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              All community-reported queries for {currentWorkspace?.name || 'your workspace'}.
            </p>
          </div>

          {currentWorkspace && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleOpenNormalReport}
            >
              New Query
            </Button>
          )}
        </div>

        <ProblemFeed
          problems={problems}
          loading={loadingProblems}
          workspace={currentWorkspace}
          currentUser={currentUser}
          onOpenReportModal={handleOpenNormalReport}
          onRefresh={loadProblems}
        />
      </section>

      {/* Modals */}
      <SubmitProblemModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        workspace={currentWorkspace}
        currentUser={currentUser}
        userProfile={userProfile}
        defaultEmergency={reportIsEmergency}
        candidateProblems={problems}
        onProblemSubmitted={handleProblemSubmitted}
      />

      <WorkspaceHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        workspace={currentWorkspace}
      />

      {/* User AI Chatbot Modal */}
      <UserChatbotModal
        isOpen={chatbotOpen}
        onClose={() => setChatbotOpen(false)}
        workspace={currentWorkspace}
        userProfile={userProfile}
        currentUser={currentUser}
        onProblemSubmitted={handleProblemSubmitted}
      />

      {/* Floating AI Assistant Quick Trigger */}
      {currentWorkspace && (
        <aside
          aria-label="AI Assistant Quick Access"
          className="fixed bottom-24 right-5 sm:bottom-8 sm:right-8 z-30 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setChatbotOpen(true)}
            className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--glass-border)] shadow-xl hover:shadow-2xl hover:border-[var(--primary)]/40 transition-all cursor-pointer backdrop-blur-xl"
            title="Open UNSAID AI Assistant"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--cyan)]/25 to-[var(--primary)]/25 flex items-center justify-center p-0.5 shrink-0">
              <UnsaidLogoMark size={28} animated={true} showShadow={false} />
            </div>
            <span className="text-xs font-semibold text-[var(--text)] group-hover:text-[var(--cyan)] transition-colors pr-1 whitespace-nowrap">
              AI Assistant
            </span>
          </button>
        </aside>
      )}
    </PageContainer>
    </>
  );
};
