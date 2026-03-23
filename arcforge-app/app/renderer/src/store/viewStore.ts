/**
 * View store — sidebar panel visibility.
 * Synced from main process via View menu toggles.
 */

import { create } from 'zustand';

export type ViewPanelId = 'explorer' | 'sourceControl' | 'tasks' | 'testResults' | 'issues';

export interface ViewState {
  explorer: boolean;
  sourceControl: boolean;
  tasks: boolean;
  testResults: boolean;
  issues: boolean;
  minimapVisible: boolean;
  controlsVisible: boolean;
  /** How the code editor is shown relative to the graph. */
  editorLayoutMode: 'tab' | 'split';
}

const DEFAULT_STATE: ViewState = {
  explorer: true,
  sourceControl: false,
  tasks: false,
  testResults: false,
  issues: false,
  minimapVisible: false,
  controlsVisible: false,
  editorLayoutMode: 'tab',
};

interface ViewStoreState extends ViewState {
  setState: (state: ViewState) => void;
}

export const useViewStore = create<ViewStoreState>((set) => ({
  ...DEFAULT_STATE,
  setState: (state) => set(state),
}));
