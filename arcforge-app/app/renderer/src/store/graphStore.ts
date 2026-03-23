/**
 * Zustand store for graph, project, and editor state (renderer).
 * Synced from main process via IPC.
 */

import { create } from 'zustand';
import type { ArcforgeGraph } from '../global';
import type { AnalysisIssue } from '../../../shared/types';
import type { AnalysisStatus } from '../../../shared/types';
import type { PluginInfo } from '../../../shared/types/plugin';

export interface GraphViewport {
  x: number;
  y: number;
  zoom: number;
}

export type GraphNodePositions = Record<string, { x: number; y: number }>;

interface GraphState {
  projectPath: string | null;
  adapterId: string | null;
  /** When set, project was opened via single file (Open JSON); used for explorer title and filtering. */
  entryFileRelative: string | null;
  graph: ArcforgeGraph;
  analysisIssues: AnalysisIssue[];
  analysisStatus: AnalysisStatus | null;
  graphUpdateFromForge: boolean;
  graphViewport: GraphViewport | null;
  graphNodePositions: GraphNodePositions | null;
  /** True once loadArcforgeConfig has resolved for the current project (positions loaded or confirmed absent). */
  positionsReady: boolean;
  activePluginInfo: PluginInfo | null;
  setProject: (path: string | null, adapterId: string | null, entryFile?: string | null) => void;
  setPositionsReady: (ready: boolean) => void;
  setGraph: (graph: ArcforgeGraph, options?: { fromForge?: boolean }) => void;
  setAnalysisIssues: (issues: AnalysisIssue[]) => void;
  setAnalysisStatus: (status: AnalysisStatus | null) => void;
  setActivePlugin: (pluginInfo: PluginInfo | null) => void;
  reset: () => void;
  clearGraphUpdateFromForge: () => void;
  setGraphViewport: (viewport: GraphViewport | null) => void;
  setGraphNodePositions: (positions: GraphNodePositions | null) => void;
  /** Incremented when Forge creates/edits files so the file explorer can refresh. */
  explorerRefreshTrigger: number;
  setExplorerRefreshTrigger: () => void;
  openFilePaths: string[];
  activeTab: 'graph' | string;
  fileContents: Record<string, string>;
  /** Tracks which files have unsaved edits in the editor. */
  fileDirty: Record<string, boolean>;
  fileScrollToLine: Record<string, number>;
  fileScrollPositions: Record<string, { scrollTop: number; scrollLeft: number }>;
  openFile: (path: string, content: string, options?: { scrollToLine?: number; activate?: boolean }) => void;
  closeFile: (path: string) => void;
  setActiveTab: (tab: 'graph' | string) => void;
  moveFileTab: (sourcePath: string, targetPath: string) => void;
  setFileContent: (path: string, content: string) => void;
  clearScrollToLine: (path: string) => void;
  setFileScrollPosition: (path: string, scrollTop: number, scrollLeft: number) => void;
  setFileDirty: (path: string, dirty: boolean) => void;
}

const emptyGraph: ArcforgeGraph = { nodes: [], edges: [] };

export const useGraphStore = create<GraphState>((set) => ({
  projectPath: null,
  adapterId: null,
  entryFileRelative: null,
  graph: emptyGraph,
  analysisIssues: [],
  analysisStatus: null,
  graphUpdateFromForge: false,
  graphViewport: null,
  graphNodePositions: null,
  positionsReady: false,
  activePluginInfo: null,
  setPositionsReady: (positionsReady) => set({ positionsReady }),
  setProject: (projectPath, adapterId, entryFile) =>
    set((s) => {
      if (s.projectPath === projectPath && s.entryFileRelative === (entryFile ?? null)) return { projectPath, adapterId, entryFileRelative: entryFile ?? null };
      return {
        projectPath,
        adapterId,
        entryFileRelative: entryFile ?? null,
        graphViewport: null,
        graphNodePositions: null,
        positionsReady: false,
        openFilePaths: [],
        activeTab: 'graph' as const,
        fileContents: {},
        fileDirty: {},
        fileScrollToLine: {},
        fileScrollPositions: {},
      };
    }),
  setGraph: (graph, options) =>
    set({
      graph,
      graphUpdateFromForge: options?.fromForge === true,
    }),
  setAnalysisIssues: (issues) => set({ analysisIssues: issues }),
  setAnalysisStatus: (analysisStatus) => set({ analysisStatus }),
  setActivePlugin: (activePluginInfo) => set({ activePluginInfo }),
  reset: () =>
    set({
      projectPath: null,
      graphUpdateFromForge: false,
      adapterId: null,
      entryFileRelative: null,
      graph: emptyGraph,
      analysisIssues: [],
      analysisStatus: null,
      graphViewport: null,
      graphNodePositions: null,
      positionsReady: false,
      activePluginInfo: null,
      explorerRefreshTrigger: 0,
      openFilePaths: [],
      activeTab: 'graph',
      fileContents: {},
      fileDirty: {},
      fileScrollToLine: {},
      fileScrollPositions: {},
    }),
  clearGraphUpdateFromForge: () => set({ graphUpdateFromForge: false }),
  setGraphViewport: (graphViewport) => set({ graphViewport }),
  setGraphNodePositions: (graphNodePositions) => set({ graphNodePositions }),
  explorerRefreshTrigger: 0,
  setExplorerRefreshTrigger: () => set((s) => ({ explorerRefreshTrigger: s.explorerRefreshTrigger + 1 })),
  openFilePaths: [],
  activeTab: 'graph',
  fileContents: {},
  fileDirty: {},
  fileScrollToLine: {},
  fileScrollPositions: {},
  openFile: (path, content, options) =>
    set((s) => {
      const activate = options?.activate !== false;
      return {
        openFilePaths: s.openFilePaths.includes(path) ? s.openFilePaths : [...s.openFilePaths, path],
        fileContents: { ...s.fileContents, [path]: content },
        fileDirty: { ...s.fileDirty, [path]: false },
        activeTab: activate ? path : s.activeTab,
        fileScrollToLine:
          options?.scrollToLine != null
            ? { ...s.fileScrollToLine, [path]: options.scrollToLine }
            : s.fileScrollToLine,
      };
    }),
  closeFile: (path) =>
    set((s) => {
      const openFilePaths = s.openFilePaths.filter((p) => p !== path);
      const fileContents = { ...s.fileContents };
      const fileScrollToLine = { ...s.fileScrollToLine };
      const fileScrollPositions = { ...s.fileScrollPositions };
      const fileDirty = { ...s.fileDirty };
      delete fileContents[path];
      delete fileScrollToLine[path];
      delete fileScrollPositions[path];
      delete fileDirty[path];
      return {
        openFilePaths,
        fileContents,
        fileScrollToLine,
        fileScrollPositions,
        fileDirty,
        activeTab: s.activeTab === path ? (openFilePaths[0] ?? 'graph') : s.activeTab,
      };
    }),
  moveFileTab: (sourcePath, targetPath) =>
    set((s) => {
      if (sourcePath === targetPath) return s;
      const current = [...s.openFilePaths];
      const fromIndex = current.indexOf(sourcePath);
      const toIndex = current.indexOf(targetPath);
      if (fromIndex === -1 || toIndex === -1) return s;
      current.splice(fromIndex, 1);
      current.splice(toIndex, 0, sourcePath);
      return { openFilePaths: current };
    }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setFileContent: (path, content) =>
    set((s) => {
      const prev = s.fileContents[path];
      const nextContents = { ...s.fileContents, [path]: content };
      const nextDirty =
        content !== prev
          ? { ...s.fileDirty, [path]: true }
          : s.fileDirty;
      return { fileContents: nextContents, fileDirty: nextDirty };
    }),
  clearScrollToLine: (path) =>
    set((s) => {
      if (s.fileScrollToLine[path] == null) return s;
      const next = { ...s.fileScrollToLine };
      delete next[path];
      return { fileScrollToLine: next };
    }),
  setFileScrollPosition: (path, scrollTop, scrollLeft) =>
    set((s) => ({
      fileScrollPositions: { ...s.fileScrollPositions, [path]: { scrollTop, scrollLeft } },
    })),
  setFileDirty: (path, dirty) =>
    set((s) => ({
      fileDirty: { ...s.fileDirty, [path]: dirty },
    })),
}));
