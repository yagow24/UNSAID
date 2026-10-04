import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Calendar,
  Building2,
  User,
  ChevronDown,
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ModalShell } from '../ui/ModalShell';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { subscribeToAllWorkspaceRequests } from '../../services/workspaceRequestService';

export const WorkspaceRequestsModal = ({ isOpen, onClose, workspace }) => {
  const {
    workspaces,
    currentWorkspace,
    switchWorkspace,
    getWorkspaceRequests,
    reviewJoinRequest,
  } = useWorkspace();

  // Active workspace resolution
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    () => workspace?.id || currentWorkspace?.id || workspaces[0]?.id || ''
  );

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState('');

  // Keep selectedWorkspaceId in sync whenever modal opens or props change
  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (ignore) return;
      if (isOpen) {
        if (workspace?.id) {
          setSelectedWorkspaceId(workspace.id);
        } else if (!selectedWorkspaceId && currentWorkspace?.id) {
          setSelectedWorkspaceId(currentWorkspace.id);
        } else if (!selectedWorkspaceId && workspaces.length > 0) {
          setSelectedWorkspaceId(workspaces[0].id);
        }
      }
    });
    return () => {
      ignore = true;
    };
  }, [isOpen, workspace?.id, currentWorkspace?.id, workspaces, selectedWorkspaceId]);

  // Dynamically resolve target workspace object from active ID
  const selectedWorkspace = useMemo(() => {
    if (selectedWorkspaceId) {
      const found = workspaces.find((w) => w.id === selectedWorkspaceId);
      if (found) return found;
    }
    if (workspace?.id) return workspace;
    return currentWorkspace || workspaces[0] || null;
  }, [selectedWorkspaceId, workspaces, workspace, currentWorkspace]);

  // Load requests strictly scoped to the target workspace ID
  const loadRequests = useCallback(
    async (targetId) => {
      const wsId = targetId || selectedWorkspace?.id;
      if (!wsId) {
        setRequests([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await getWorkspaceRequests(wsId);
        setRequests(data);
      } catch (err) {
        console.error('[UNSAID Load Requests Error]', err);
        setError('Failed to fetch pending requests.');
      } finally {
        setLoading(false);
      }
    },
    [selectedWorkspace?.id, getWorkspaceRequests]
  );

  // When modal is open or target workspace changes, listen in real-time
  useEffect(() => {
    let ignore = false;
    if (isOpen && selectedWorkspace?.id) {
      queueMicrotask(() => {
        if (!ignore) {
          setLoading(true);
          setError('');
        }
      });

      const unsubscribe = subscribeToAllWorkspaceRequests(
        selectedWorkspace.id,
        (data) => {
          if (!ignore) {
            setRequests(data);
            setLoading(false);
          }
        },
        (err) => {
          if (!ignore) {
            console.error('[UNSAID Load Requests Error]', err);
            setError('Failed to fetch workspace requests.');
            setLoading(false);
          }
        }
      );

      return () => {
        ignore = true;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } else if (!isOpen) {
      queueMicrotask(() => {
        if (!ignore) {
          setRequests([]);
          setError('');
          setActionLoadingId(null);
        }
      });
    }
  }, [isOpen, selectedWorkspace?.id]);

  const handleReview = async (request, decision) => {
    if (!selectedWorkspace?.id) return;
    setActionLoadingId(request.id);
    setError('');
    try {
      await reviewJoinRequest(
        request.id,
        decision,
        selectedWorkspace.id,
        request.userId,
        request.inviteToken || request.inviteId
      );
      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? {
                ...r,
                status: decision,
                reviewedAt: new Date(),
              }
            : r
        )
      );
    } catch (err) {
      console.error('[UNSAID Review Request Error]', err);
      setError(err.message || 'Failed to update request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClose = () => {
    setRequests([]);
    setError('');
    setActionLoadingId(null);
    onClose();
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    const date =
      typeof ts.toDate === 'function'
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : typeof ts === 'number'
        ? new Date(ts)
        : null;
    if (!date) return 'N/A';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const totalCount = requests.length;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="Workspace Join Requests"
      subtitle={`Review and manage user access requests for "${selectedWorkspace?.name || 'Workspace'}"`}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-2">
        {/* Workspace Selector (shown when multiple workspaces exist to allow switching) */}
        {!workspace?.id && workspaces.length > 0 && (
          <div className="space-y-1.5 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)]">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Target Workspace
            </label>
            <div className="relative">
              <select
                value={selectedWorkspaceId || selectedWorkspace?.id || ''}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedWorkspaceId(newId);
                  switchWorkspace(newId);
                  setError('');
                }}
                className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] text-xs text-[var(--text)] font-medium focus:outline-none cursor-pointer pr-10"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id} className="bg-[var(--surface-dark)] text-[var(--text)]">
                    {ws.name} ({ws.domain || 'organization'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              Pending: <strong className="text-[var(--text)]">{pendingCount}</strong>
            </span>
            <span className="text-xs text-[var(--text-muted)]">•</span>
            <span className="text-xs text-[var(--text-muted)]">
              Total: <strong className="text-[var(--text)]">{totalCount}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => loadRequests(selectedWorkspace?.id)}
            disabled={loading}
            className="text-xs text-[var(--primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-[var(--danger-light)] border border-[var(--danger)]/30 text-[var(--danger)] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] animate-pulse">
            Loading membership requests for "{selectedWorkspace?.name || 'Workspace'}"...
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-1">
            <p className="font-semibold text-[var(--text)]">
              No pending join requests
            </p>
            <p>Generate an invite link to allow users to request access.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border)] max-h-96 overflow-y-auto pr-1">
            {requests.map((req) => {
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';

              let statusVariant = 'medium';
              if (isApproved) statusVariant = 'low';
              if (isRejected) statusVariant = 'high';

              return (
                <div
                  key={req.id}
                  className="py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--glass-hover)] rounded-2xl transition-all"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 font-semibold text-sm text-[var(--text)]">
                        <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>{req.userName || 'UNSAID Member'}</span>
                      </div>
                      <Badge variant={statusVariant} size="sm" dot>
                        {req.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-[var(--text-muted)] font-mono">
                      {req.userEmail}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[var(--cyan)]" />
                        Workspace: <strong>{req.workspaceName || selectedWorkspace?.name}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Requested: {formatTimestamp(req.createdAt || req.requestedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {isPending ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={actionLoadingId === req.id}
                          onClick={() => handleReview(req, 'rejected')}
                          className="hover:border-[var(--danger)] hover:text-[var(--danger)]"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoadingId === req.id}
                          onClick={() => handleReview(req, 'approved')}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        {isApproved ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-[var(--glass-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
};
