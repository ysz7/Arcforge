/**
 * Zustand store for pending Forge changes (diff review).
 * After a Forge execution, file diffs are stored here so the user can review red/green changes
 * and confirm ("Keep") or discard ("Discard") them.
 */

import { create } from 'zustand';

export interface FileDiff {
  filePath: string;
  /** Original content before mutation (empty string for newly created files). */
  original: string;
  /** Modified content after mutation. */
  modified: string;
  /** True if the file was newly created (no original content). */
  isNew: boolean;
}

interface PendingChangesState {
  /** Backup ID of the pending Forge execution (null = no pending changes). */
  pendingBackupId: string | null;
  /** File diffs for all affected files. */
  diffs: FileDiff[];
  /** Whether we are currently processing keep/discard. */
  processing: boolean;

  /** Set pending changes after a Forge execution. */
  setPending: (backupId: string, diffs: FileDiff[]) => void;
  /** Clear pending state (after keep or discard). */
  clearPending: () => void;
  /** Remove a single file from pending diffs (after keep or undo single file). */
  removeDiff: (filePath: string) => void;
  /** Set processing flag. */
  setProcessing: (v: boolean) => void;
}

export const usePendingChangesStore = create<PendingChangesState>((set) => ({
  pendingBackupId: null,
  diffs: [],
  processing: false,

  setPending: (pendingBackupId, diffs) =>
    set({ pendingBackupId, diffs, processing: false }),

  clearPending: () =>
    set({ pendingBackupId: null, diffs: [], processing: false }),

  removeDiff: (filePath) =>
    set((s) => {
      const next = s.diffs.filter((d) => d.filePath !== filePath);
      const cleared = next.length === 0 ? null : s.pendingBackupId;
      return { diffs: next, pendingBackupId: cleared };
    }),

  setProcessing: (processing) => set({ processing }),
}));
