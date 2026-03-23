/**
 * IPC API contract — types for renderer ↔ main communication.
 */

import type { Graph, AnalysisIssue } from './graph';
import type { FileMutation, ForgePreview, ForgeResult, ForgeFileDiff } from './forge';
import type { PluginInfo } from './plugin';

/** Serializable graph (same shape as Graph, used for IPC). */
export type ArcforgeGraph = Graph;

/** Serializable file mutation (matches FileMutation, includes replace). */
export type ForgeFileMutation = FileMutation;

/** Serializable graph mutation. */
export interface ForgeGraphMutation {
  newNodes: Array<{ id: string; type: string; filePath: string; label: string; metadata: Record<string, unknown> }>;
  newEdges: Array<{ id: string; from: string; to: string; type: string }>;
}

export interface ForgeValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: Array<{ filePath: string; reason: string; suggestion: string }>;
}

export interface ForgeBlueprintInfo {
  name: string;
  displayName: string;
  description: string;
  category?: string;
  supportedNodeTypes: string[];
  params: Array<{
    name: string;
    label: string;
    required: boolean;
    default?: string;
    deriveFrom?: 'label' | 'metadata';
    metadataKey?: string;
    quickSuggestions?: string[];
  }>;
}

export interface ForgePreviewIPC extends Omit<ForgePreview, 'mutations' | 'graphMutations'> {
  mutations: ForgeFileMutation[];
  graphMutations: ForgeGraphMutation;
  validation: ForgeValidation;
}

export interface ForgeResultIPC extends Omit<ForgeResult, 'mutations' | 'graphMutations'> {
  mutations: ForgeFileMutation[];
  graphMutations: ForgeGraphMutation;
}


export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';

export interface TestResult {
  name: string;
  class: string;
  file: string;
  line: number;
  status: 'pass' | 'fail';
  message?: string;
}

export interface ViewPanelState {
  explorer: boolean;
  sourceControl: boolean;
  tasks: boolean;
  testResults: boolean;
  issues: boolean;
  minimapVisible: boolean;
  controlsVisible: boolean;
}

export interface AnalysisStatus {
  message: string;
  current?: number;
  total?: number;
  controllersCurrent?: number;
  controllersTotal?: number;
  phase?: 'discover' | 'parsing' | 'building_graph' | 'done';
}

export interface ArcforgeAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    onPrepareClose: (callback: () => void) => () => void;
    readyToClose: () => void;
    cancelClose: () => void;
  };
  view: {
    getState: () => Promise<ViewPanelState>;
    setState: (state: Partial<ViewPanelState>) => Promise<void>;
    onStateChanged: (callback: (state: ViewPanelState) => void) => () => void;
  };
  project: {
    open: () => Promise<{ ok: boolean; projectPath?: string; adapterId?: string; error?: string }>;
    openJson: () => Promise<{ ok: boolean; projectPath?: string; adapterId?: string; error?: string }>;
    createArchitecture: () => Promise<{ ok: boolean; projectPath?: string; adapterId?: string; error?: string }>;
    openArchitecture: () => Promise<{ ok: boolean; projectPath?: string; adapterId?: string; error?: string }>;
    openWithPlugin: (pluginId: string) => Promise<{ ok: boolean; projectPath?: string; adapterId?: string; error?: string }>;
    createWithPlugin: (pluginId: string) => Promise<{ ok: boolean; projectPath?: string; adapterId?: string; error?: string }>;
    close: () => Promise<{ ok: boolean }>;
    onOpened: (callback: (payload: { projectPath: string; adapterId: string; entryFile?: string; pluginInfo?: PluginInfo }) => void) => () => void;
    onClosed: (callback: () => void) => () => void;
    onOpenError: (callback: (error: string) => void) => () => void;
  };
  plugins: {
    list: () => Promise<PluginInfo[]>;
    importPlugin: () => Promise<{ ok: boolean; pluginId?: string; error?: string }>;
    deletePlugin: (pluginId: string) => Promise<{ ok: boolean; error?: string }>;
    revealPlugin: (pluginId: string) => Promise<{ ok: boolean; error?: string }>;
  };
  analysis: {
    onStatus: (callback: (status: AnalysisStatus) => void) => () => void;
  };
  git: {
    status: (projectPath: string) => Promise<{
      ok: boolean;
      files?: Array<{ path: string; status: GitFileStatus }>;
      error?: string;
    }>;
    diff: (projectPath: string, relativePath: string) => Promise<{
      ok: boolean;
      content?: string | null;
      error?: string;
    }>;
    stage: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; error?: string }>;
    unstage: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; error?: string }>;
    commit: (projectPath: string, message: string) => Promise<{ ok: boolean; error?: string }>;
  };
  shell: {
    run: (projectPath: string, command: string) => Promise<{
      ok: boolean;
      stdout: string;
      stderr: string;
      exitCode: number;
      error?: string;
    }>;
  };
  phpunit: {
    run: (projectPath: string, filter?: string) => Promise<{
      ok: boolean;
      results: TestResult[];
      error?: string;
    }>;
  };
  graph: {
    get: () => Promise<{ graph: ArcforgeGraph; issues: AnalysisIssue[] }>;
    onUpdated: (callback: (payload: { graph: ArcforgeGraph; issues: AnalysisIssue[] }) => void) => void;
    subscribe: () => Promise<void>;
    /** Backend must support route_resource. For mode 'chain' on route_resource: delete resource node + all route nodes under it + full subsequent flow (same as flow). */
    deleteNode: (nodeId: string, mode: 'node' | 'flow' | 'chain') => Promise<{ ok: boolean; deleted?: string[]; error?: string }>;
    addConnection: (params: {
      source: string;
      sourceHandle: string | null;
      target: string;
      targetHandle: string | null;
    }) => Promise<{ ok: boolean; error?: string }>;
    addNode: (params: {
      type: string;
      label?: string;
      position: { x: number; y: number };
    }) => Promise<{ ok: boolean; nodeId?: string; error?: string }>;
    deleteEdge: (edgeId: string) => Promise<{ ok: boolean; error?: string }>;
    renameNode: (nodeId: string, label: string) => Promise<{ ok: boolean; error?: string }>;
  };
  fs: {
    listDir: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; entries: Array<{ name: string; isDirectory: boolean }> }>;
    readFile: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; content: string | null }>;
    writeFile: (projectPath: string, relativePath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
    mkdir: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; error?: string }>;
    deletePath: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; error?: string }>;
    renamePath: (projectPath: string, fromRelative: string, toRelative: string) => Promise<{ ok: boolean; error?: string }>;
    revealInExplorer: (projectPath: string, relativePath: string) => Promise<{ ok: boolean; error?: string }>;
  };
  forge: {
    getBlueprints: (nodeType: string) => Promise<ForgeBlueprintInfo[]>;
    preview: (blueprintName: string, sourceNodeId: string, params: Record<string, string>) => Promise<{ ok: boolean; preview?: ForgePreviewIPC; error?: string }>;
    execute: (blueprintName: string, sourceNodeId: string, params: Record<string, string>) => Promise<{ ok: boolean; result?: ForgeResultIPC; pendingDiffs?: ForgeFileDiff[]; error?: string }>;
    rollback: (backupId: string) => Promise<{ ok: boolean; error?: string }>;
    confirmPending: (backupId: string) => Promise<{ ok: boolean; error?: string }>;
    confirmPendingFile: (backupId: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;
    discardPending: (backupId: string) => Promise<{ ok: boolean; error?: string }>;
    rollbackPendingFile: (backupId: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;
  };
  external: {
    open: (url: string) => Promise<void>;
  };
  updates: {
    getStatus: () => Promise<import('../appInfo').UpdateStatus>;
    checkNow: () => Promise<import('../appInfo').UpdateStatus>;
  };
}
