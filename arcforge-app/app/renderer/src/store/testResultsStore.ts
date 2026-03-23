/**
 * Test results store — shared between TestResultsPanel and Run tests command.
 */

import { create } from 'zustand';
import type { TestResult } from '../../../shared/types';
import { useNotificationStore } from './notificationStore';

interface TestResultsState {
  results: TestResult[];
  loading: boolean;
  setResults: (results: TestResult[]) => void;
  setLoading: (loading: boolean) => void;
  runTests: (projectPath: string | null, filter?: string) => Promise<void>;
}

declare const window: Window & { arcforge?: import('../global').ArcforgeAPI };

export const useTestResultsStore = create<TestResultsState>((set, get) => ({
  results: [],
  loading: false,
  setResults: (results) => set({ results }),
  setLoading: (loading) => set({ loading }),
  runTests: async (projectPath, filter) => {
    if (!projectPath || !window.arcforge?.phpunit) return;
    set({ loading: true, results: [] });
    try {
      const res = await window.arcforge.phpunit.run(projectPath, filter);
      set({ results: res.results ?? [] });
      if (!res.ok && res.error) {
        useNotificationStore.getState().add('error', res.error);
      }
    } finally {
      set({ loading: false });
    }
  },
}));
