import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Building2,
  Check,
  Plus,
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useAuth } from '../../hooks/useAuth';


/**
 * WorkspaceSwitcher Component
 * Frosted glass dropdown allowing authorized users to switch between their approved workspaces.
 */
export const WorkspaceSwitcher = ({ onOpenCreateModal, className = '' }) => {
  const {
    workspaces,
    currentWorkspace,
    memberships,
    currentWorkspaceRole,
    switchWorkspace,
    loading,
  } = useWorkspace();
  const { isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click/touch outside and on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectWorkspace = (wsId) => {
    switchWorkspace(wsId);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Current Workspace Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="workspace-dropdown-menu"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] text-[var(--text)] transition-all duration-200 shadow-sm cursor-pointer active:scale-98 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] select-none"
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] text-white flex items-center justify-center shrink-0 shadow-xs">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-left flex items-center gap-1.5 max-w-[130px] sm:max-w-[190px] md:max-w-[240px]">
          <span className="text-xs font-bold truncate leading-tight text-[var(--text)]">
            {currentWorkspace ? currentWorkspace.name : loading ? 'Loading...' : 'No Approved Workspaces'}
          </span>
          {currentWorkspaceRole && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 hidden sm:inline-block ${
                currentWorkspaceRole === 'admin'
                  ? 'bg-[var(--cyan-light)] text-[var(--cyan)]'
                  : 'bg-[var(--surface-active)] text-[var(--text-secondary)]'
              }`}
            >
              {currentWorkspaceRole}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[var(--primary)]' : ''
          }`}
        />
      </button>

      {/* Floating Liquid Glass Workspace Surface */}
      {isOpen && (
        <div
          id="workspace-dropdown-menu"
          role="menu"
          className="glass-modal absolute top-[calc(100%+10px)] left-0 w-80 sm:w-88 max-w-[calc(100vw-2rem)] p-3 z-50 space-y-2 shadow-2xl border border-[var(--glass-highlight)] backdrop-blur-3xl animate-fade-in"
        >
          <div className="px-3 py-2 border-b border-[var(--glass-border)] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
              Your Workspaces
            </span>
            <span className="text-[10px] text-[var(--primary)] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-light)]">
              {workspaces.length} {workspaces.length === 1 ? 'Workspace' : 'Workspaces'}
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 py-1 pr-1 overscroll-contain">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)] space-y-2 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] animate-pulse">
                <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-semibold text-[var(--text)]">Syncing workspaces...</p>
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)] space-y-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)]">
                <p className="font-bold text-[var(--text)] text-sm">No Approved Workspaces</p>
                <p className="text-[11px] leading-relaxed">
                  {isAdmin
                    ? 'Start by creating your first workspace below.'
                    : 'Ask your organization administrator for an invite link to join.'}
                </p>
              </div>
            ) : (
              workspaces.map((ws) => {
                const isSelected = currentWorkspace?.id === ws.id;
                const memberRecord = memberships.find((m) => m.workspaceId === ws.id);
                const roleInWs =
                  ws.userRole ||
                  memberRecord?.role ||
                  (isAdmin ? 'admin' : 'member');

                return (
                  <button
                    key={ws.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelectWorkspace(ws.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/40 font-semibold shadow-xs'
                        : 'text-[var(--text)] hover:bg-[var(--surface-hover)] border border-[var(--glass-border)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="truncate min-w-0">
                        <div className="text-xs font-bold truncate leading-tight text-[var(--text)]">
                          {ws.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium">
                            {ws.domain || 'Organization'}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              roleInWs === 'admin'
                                ? 'bg-[var(--cyan-light)] text-[var(--cyan)]'
                                : 'bg-[var(--surface-active)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {roleInWs}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        <span className="text-[10px] uppercase font-bold text-[var(--primary)] hidden sm:inline">Active</span>
                        <Check className="w-4 h-4 text-[var(--primary)]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Admin Create Action */}
          {isAdmin && onOpenCreateModal && (
            <div className="pt-1.5 border-t border-[var(--glass-border)]">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-light)] transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Workspace</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
