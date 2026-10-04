import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Check,
  Trash2,
  ArrowRight,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';

const formatTimestamp = (ts) => {
  if (!ts) return 'Just now';
  const date =
    typeof ts.toDate === 'function'
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : typeof ts === 'number'
      ? new Date(ts)
      : null;
  if (!date) return 'Just now';

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export const NotificationsModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotif,
  } = useNotifications();

  const { switchWorkspace } = useWorkspace();

  const handleOpenWorkspace = async (item) => {
    if (item.id && !item.read) {
      await markAsRead(item.id);
    }
    if (item.workspaceId) {
      switchWorkspace(item.workspaceId);
    }
    onClose();
    navigate('/app');
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      subtitle="Updates on your workspace access requests and administrative actions"
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              Unread: <strong className="text-[var(--text)]">{unreadCount}</strong>
            </span>
            <span className="text-xs text-[var(--text-muted)]">•</span>
            <span className="text-xs text-[var(--text-muted)]">
              Total: <strong className="text-[var(--text)]">{notifications.length}</strong>
            </span>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              <Check className="w-3.5 h-3.5" /> Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
              <Bell className="w-5 h-5 opacity-50" />
            </div>
            <p className="font-semibold text-sm text-[var(--text)]">
              No notifications yet
            </p>
            <p className="max-w-xs mx-auto text-[var(--text-muted)]">
              You're all caught up! Updates regarding your join requests and account will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border)] max-h-96 overflow-y-auto pr-1">
            {notifications.map((item) => {
              const isApproved = item.type === 'request_approved';
              const isRejected = item.type === 'request_rejected';
              const isEmergencyProblem = item.type === 'emergency_problem';
              const isProblemReported = item.type === 'problem_reported';

              return (
                <div
                  key={item.id}
                  onClick={() => !item.read && markAsRead(item.id)}
                  className={`py-3.5 px-3 flex items-start gap-3 rounded-2xl transition-all cursor-pointer ${
                    !item.read
                      ? isEmergencyProblem
                        ? 'bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/15'
                        : 'bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10'
                      : 'hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  {/* Status Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isApproved
                        ? 'bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/30'
                        : isRejected || isEmergencyProblem
                        ? 'bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/30'
                        : isProblemReported
                        ? 'bg-[var(--cyan-light)] text-[var(--cyan)] border border-[var(--cyan)]/30'
                        : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--glass-border)]'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isRejected ? (
                      <XCircle className="w-4 h-4" />
                    ) : isEmergencyProblem ? (
                      <AlertTriangle className="w-4 h-4 animate-bounce" />
                    ) : isProblemReported ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text)]">
                          {item.title || (isApproved ? 'Request Approved' : isRejected ? 'Request Rejected' : 'New Notification')}
                        </span>
                        {!item.read && (
                          <span className={`w-2 h-2 rounded-full inline-block ${isEmergencyProblem ? 'bg-rose-500 animate-pulse' : 'bg-[var(--cyan)]'}`} />
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {item.message}
                    </p>

                    {item.workspaceName && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] pt-0.5">
                        <Building2 className="w-3 h-3 text-[var(--cyan)] shrink-0" />
                        <span className="truncate">
                          Workspace: <strong>{item.workspaceName}</strong>
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1.5">
                      {isApproved && item.workspaceId && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWorkspace(item);
                          }}
                          iconRight={<ArrowRight className="w-3 h-3" />}
                        >
                          Open Workspace
                        </Button>
                      )}
                      {(isEmergencyProblem || isProblemReported) && item.workspaceId && (
                        <Button
                          variant={isEmergencyProblem ? 'danger' : 'primary'}
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!item.read) await markAsRead(item.id);
                            if (switchWorkspace) await switchWorkspace(item.workspaceId);
                            onClose();
                            navigate('/admin');
                          }}
                          iconRight={<ArrowRight className="w-3 h-3" />}
                        >
                          View in Triage
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotif(item.id);
                        }}
                        className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors cursor-pointer ml-auto"
                        title="Delete notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};
