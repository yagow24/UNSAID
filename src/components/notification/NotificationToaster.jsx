import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useWorkspace } from '../../hooks/useWorkspace';

export const NotificationToaster = () => {
  const { toasts, dismissToast, markAsRead } = useNotifications();
  const { switchWorkspace } = useWorkspace();
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) return null;

  const handleActionClick = async (toast) => {
    if (toast.notifId) {
      await markAsRead(toast.notifId);
    }
    if (toast.workspaceId && switchWorkspace) {
      await switchWorkspace(toast.workspaceId);
    }
    dismissToast(toast.id);

    if (toast.actionUrl) {
      navigate(toast.actionUrl);
    } else if (toast.type === 'problem_reported' || toast.type === 'emergency_problem') {
      navigate('/admin');
    } else if (toast.type === 'problem_resolved_verification' || toast.type === 'resolution_verified') {
      navigate('/app');
    }
  };

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isEmergency = toast.type === 'emergency_problem' || toast.type === 'resolution_reopened';
        const isSuccess = toast.type === 'request_approved' || toast.type === 'resolution_verified';
        const isResolution = toast.type === 'problem_resolved_verification' || toast.type === 'verification_vote_submitted';
        const isMessage = toast.type === 'thread_reply';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 transform translate-y-0 animate-fade-in ${
              isEmergency
                ? 'bg-[var(--surface)]/95 border-[var(--danger)]/50 ring-1 ring-[var(--danger)]/30 text-[var(--text)]'
                : isSuccess
                ? 'bg-[var(--surface)]/95 border-[var(--success)]/50 ring-1 ring-[var(--success)]/30 text-[var(--text)]'
                : isResolution
                ? 'bg-[var(--surface)]/95 border-[var(--cyan)]/50 ring-1 ring-[var(--cyan)]/30 text-[var(--text)]'
                : 'bg-[var(--surface)]/95 border-[var(--glass-border)] ring-1 ring-[var(--primary)]/20 text-[var(--text)]'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                  isEmergency
                    ? 'bg-[var(--danger-light)] text-[var(--danger)]'
                    : isSuccess
                    ? 'bg-[var(--success-light)] text-[var(--success)]'
                    : isResolution
                    ? 'bg-[var(--cyan-light)] text-[var(--cyan)]'
                    : isMessage
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-[var(--primary-light)] text-[var(--primary)]'
                }`}
              >
                {isEmergency ? (
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isResolution ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : isMessage ? (
                  <MessageSquare className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <h5 className="text-xs font-bold text-[var(--text)] tracking-tight truncate">
                    {toast.title || 'Notification Alert'}
                  </h5>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                  {toast.message}
                </p>

                {toast.workspaceName && (
                  <div className="text-[10px] text-[var(--cyan)] font-mono truncate">
                    {toast.workspaceName}
                  </div>
                )}

                {/* Quick Action Button */}
                <div className="pt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleActionClick(toast)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--cyan)] hover:underline cursor-pointer"
                  >
                    <span>View details</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
