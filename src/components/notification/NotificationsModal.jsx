import React, { useState } from 'react';
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
  ShieldCheck,
  UserCheck,
  Vote,
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
      : typeof ts === 'string'
      ? new Date(ts)
      : null;
  if (!date || isNaN(date.getTime())) return 'Just now';

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
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unread'

  const filteredNotifications = notifications.filter((n) => {
    if (filterTab === 'unread') return !n.read;
    return true;
  });

  const handleOpenWorkspace = async (item) => {
    if (item.id && !item.read) {
      await markAsRead(item.id);
    }
    if (item.workspaceId && switchWorkspace) {
      await switchWorkspace(item.workspaceId);
    }
    onClose();
    const probParam = item.problemId ? `?problem=${item.problemId}` : '';
    navigate(`/app${probParam}`);
  };

  const handleNavigateAdmin = async (item) => {
    if (item.id && !item.read) {
      await markAsRead(item.id);
    }
    if (item.workspaceId && switchWorkspace) {
      await switchWorkspace(item.workspaceId);
    }
    onClose();
    const probParam = item.problemId ? `?problem=${item.problemId}` : '';
    navigate(`/admin${probParam}`);
  };

  const handleNavigateUser = async (item) => {
    if (item.id && !item.read) {
      await markAsRead(item.id);
    }
    if (item.workspaceId && switchWorkspace) {
      await switchWorkspace(item.workspaceId);
    }
    onClose();
    const probParam = item.problemId ? `?problem=${item.problemId}` : '';
    navigate(`/app${probParam}`);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications & Alerts"
      subtitle="Live updates on queries, resolutions, verification votes, and workspace access"
      maxWidth="md"
    >
      <div className="space-y-3.5 pt-1">
        {/* Header Tabs & Actions */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--glass-border)] pb-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filterTab === 'all'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unread')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                filterTab === 'unread'
                  ? 'bg-[var(--cyan)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-[var(--cyan)] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              <Check className="w-3.5 h-3.5" /> Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
              <Bell className="w-5 h-5 opacity-50" />
            </div>
            <p className="font-semibold text-sm text-[var(--text)]">
              {filterTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="max-w-xs mx-auto text-[var(--text-muted)]">
              Real-time alerts for queries, votes, resolutions, and invitations will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border)] max-h-96 overflow-y-auto pr-1">
            {filteredNotifications.map((item) => {
              const isApproved = item.type === 'request_approved';
              const isRejected = item.type === 'request_rejected';
              const isEmergency = item.type === 'emergency_problem' || item.type === 'resolution_reopened';
              const isProblemReported = item.type === 'problem_reported';
              const isResolvedPoll = item.type === 'problem_resolved_verification';
              const isVerified = item.type === 'resolution_verified';
              const isVote = item.type === 'verification_vote_submitted' || item.type === 'verification_vote_confirmed';
              const isMessage = item.type === 'thread_reply';
              const isJoinReq = item.type === 'request_received';

              return (
                <div
                  key={item.id}
                  onClick={() => !item.read && markAsRead(item.id)}
                  className={`py-3.5 px-3 flex items-start gap-3 rounded-2xl transition-all cursor-pointer ${
                    !item.read
                      ? isEmergency
                        ? 'bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/15'
                        : isVerified || isApproved
                        ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15'
                        : isResolvedPoll || isVote
                        ? 'bg-[var(--cyan)]/10 border border-[var(--cyan)]/30 hover:bg-[var(--cyan)]/15'
                        : 'bg-[var(--primary)]/10 border border-[var(--primary)]/30 hover:bg-[var(--primary)]/15'
                      : 'hover:bg-[var(--glass-hover)] border border-transparent'
                  }`}
                >
                  {/* Status Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                      isApproved || isVerified
                        ? 'bg-[var(--success-light)] text-[var(--success)] border border-[var(--success)]/30'
                        : isRejected || isEmergency
                        ? 'bg-[var(--danger-light)] text-[var(--danger)] border border-[var(--danger)]/30'
                        : isResolvedPoll || isVote
                        ? 'bg-[var(--cyan-light)] text-[var(--cyan)] border border-[var(--cyan)]/30'
                        : isMessage
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : isJoinReq
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-[var(--surface-hover)] text-[var(--text-muted)] border border-[var(--glass-border)]'
                    }`}
                  >
                    {isApproved || isVerified ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isRejected ? (
                      <XCircle className="w-4 h-4" />
                    ) : isEmergency ? (
                      <AlertTriangle className="w-4 h-4 animate-bounce" />
                    ) : isResolvedPoll ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : isVote ? (
                      <Vote className="w-4 h-4" />
                    ) : isMessage ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : isJoinReq ? (
                      <UserCheck className="w-4 h-4" />
                    ) : isProblemReported ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-[var(--text)] truncate">
                          {item.title || 'Notification'}
                        </span>
                        {!item.read && (
                          <span
                            className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                              isEmergency ? 'bg-rose-500 animate-pulse' : 'bg-[var(--cyan)]'
                            }`}
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 flex items-center gap-1 font-mono">
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
                    <div className="flex items-center gap-2 pt-1.5 flex-wrap">
                      {isApproved && item.workspaceId && (
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWorkspace(item);
                          }}
                          iconRight={<ArrowRight className="w-3 h-3" />}
                        >
                          Open Workspace
                        </Button>
                      )}

                      {(isProblemReported || isEmergency || isVote || isJoinReq || item.type === 'admin_resolution_published' || item.type === 'admin_alert') && (
                        <Button
                          variant={isEmergency ? 'danger' : 'primary'}
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateAdmin(item);
                          }}
                          iconRight={<ArrowRight className="w-3 h-3" />}
                        >
                          View in Triage
                        </Button>
                      )}

                      {(isResolvedPoll || isVerified || isMessage || item.type === 'problem_submitted_confirmation' || item.type === 'resolution_reopened') && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateUser(item);
                          }}
                          iconRight={<ArrowRight className="w-3 h-3" />}
                        >
                          {isResolvedPoll ? 'Inspect Resolution' : 'View Query'}
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
        <div className="flex justify-end pt-2 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};
