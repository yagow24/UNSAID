import React from 'react';
import { WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export const OfflineBanner = () => {
  const { isOnline, isSyncing, queueCounts, triggerSync } = useOfflineSync();

  // If online, not syncing, and no pending changes, don't take up screen space
  if (isOnline && !isSyncing && queueCounts.total === 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 w-full transition-all duration-300"
    >
      <div
        className={`px-4 py-2 border-b backdrop-blur-md flex items-center justify-between gap-3 text-xs shadow-sm transition-all ${
          !isOnline
            ? 'bg-[var(--warning)]/15 border-[var(--warning)]/30 text-[var(--warning)]'
            : isSyncing
            ? 'bg-[var(--cyan)]/15 border-[var(--cyan)]/30 text-[var(--cyan)]'
            : 'bg-[var(--surface)]/90 border-[var(--glass-border)] text-[var(--text-secondary)]'
        }`}
      >
        <div className="flex items-center gap-2 max-w-xl truncate">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
          ) : isSyncing ? (
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <Cloud className="w-4 h-4 shrink-0 text-[var(--cyan)]" />
          )}

          <span className="truncate font-medium">
            {!isOnline ? (
              <>
                <strong>Offline Mode:</strong> App is running locally.
                {queueCounts.total > 0 && (
                  <span className="ml-1 font-semibold underline">
                    {queueCounts.total} {queueCounts.total === 1 ? 'item' : 'items'} queued
                  </span>
                )}
                {' · Auto-syncs on reconnect.'}
              </>
            ) : isSyncing ? (
              <span>Syncing pending offline submissions to Firestore...</span>
            ) : (
              <span>
                {queueCounts.total} pending offline {queueCounts.total === 1 ? 'change' : 'changes'} ready to sync.
              </span>
            )}
          </span>
        </div>

        {isOnline && !isSyncing && queueCounts.total > 0 && (
          <button
            type="button"
            onClick={triggerSync}
            className="px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-[11px] font-semibold hover:opacity-90 transition-all cursor-pointer shrink-0 shadow-xs"
          >
            Sync Now
          </button>
        )}

        {isOnline && isSyncing && (
          <div className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing</span>
          </div>
        )}

        {!isOnline && queueCounts.total === 0 && (
          <div className="text-[10px] text-[var(--text-muted)] shrink-0 hidden sm:block">
            Local cache active
          </div>
        )}
      </div>
    </div>
  );
};
