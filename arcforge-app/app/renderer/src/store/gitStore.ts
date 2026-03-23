/**
 * Git status store — holds changed files from git status.
 * Refreshed when project opens or user requests.
 */

import { create } from 'zustand';
import type { GitFileStatus } from '../../../shared/types';

export interface GitStatusFile {
  path: string;
  status: GitFileStatus;
}

interface GitState {
  files: GitStatusFile[];
  loading: boolean;
  error: string | null;
  fetch: (projectPath: string | null) => Promise<void>;
  reset: () => void;
}

declare const window: Window & { arcforge?: import('../global').ArcforgeAPI };

export const useGitStore = create<GitState>((set, get) => ({
  files: [],
  loading: false,
  error: null,
  fetch: async (projectPath) => {
    if (!projectPath) {
      set({ files: [], error: null });
      return;
    }
    const api = window.arcforge?.git;
    if (!api) {
      set({ files: [], error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await api.status(projectPath);
      if (res.ok && res.files) {
        set({ files: res.files, error: null });
      } else {
        set({ files: [], error: res.error ?? 'Git status failed' });
      }
    } catch {
      set({ files: [], error: 'Git status failed' });
    } finally {
      set({ loading: false });
    }
  },
  reset: () => set({ files: [], loading: false, error: null }),
}));
