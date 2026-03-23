/**
 * Floating bar shown when there are pending Forge changes awaiting review.
 * Displays file count and Keep / Discard buttons.
 */

import React, { useCallback } from 'react';
import { usePendingChangesStore } from '../store/pendingChangesStore';

declare const window: Window & { arcforge?: import('../global').ArcforgeAPI };

export interface PendingChangesBarProps {
  /** Called after keep or discard completes. Pass deleted paths when discard removes new files. */
  onResolved?: (deletedPaths?: string[]) => void;
  /** When true, render compact in the tab bar (right side) instead of full-width bar. */
  inline?: boolean;
}

export const PendingChangesBar: React.FC<PendingChangesBarProps> = ({ onResolved, inline }) => {
  const { pendingBackupId, diffs, processing, clearPending, setProcessing } =
    usePendingChangesStore();

  const handleKeep = useCallback(async () => {
    if (!pendingBackupId) return;
    setProcessing(true);
    try {
      const api = window.arcforge?.forge;
      if (api?.confirmPending) {
        await api.confirmPending(pendingBackupId);
      }
      onResolved?.();
    } finally {
      clearPending();
    }
  }, [pendingBackupId, setProcessing, clearPending, onResolved]);

  const handleDiscard = useCallback(async () => {
    if (!pendingBackupId) return;
    const deletedPaths = diffs.filter((d) => d.isNew).map((d) => d.filePath);
    setProcessing(true);
    try {
      const api = window.arcforge?.forge;
      if (api?.discardPending) {
        await api.discardPending(pendingBackupId);
      }
      onResolved?.(deletedPaths);
    } finally {
      clearPending();
    }
  }, [pendingBackupId, diffs, setProcessing, clearPending, onResolved]);

  if (!pendingBackupId || diffs.length === 0) return null;

  return (
    <div className={`arcforge-pending-bar${inline ? ' arcforge-pending-inline' : ''}`}>
      <span className="arcforge-pending-info">
        {diffs.length} file{diffs.length > 1 ? 's' : ''} changed
      </span>
      <div className="arcforge-pending-actions">
        <button
          type="button"
          className="arcforge-pending-btn arcforge-pending-discard"
          onClick={handleDiscard}
          disabled={processing}
        >
          Discard
        </button>
        <button
          type="button"
          className="arcforge-pending-btn arcforge-pending-keep"
          onClick={handleKeep}
          disabled={processing}
        >
          Keep all
        </button>
      </div>
    </div>
  );
};
