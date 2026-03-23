/**
 * Arcforge plugin interface — single contract for all framework adapters.
 * Plugins are self-contained: they define node types, connection rules, parsing, and persistence.
 */

import type { Graph, AnalysisIssue } from './graph';

export interface PluginNodeTypeDef {
  id: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  deletable: boolean;
  renameable: boolean;
  openable: boolean;
}

export interface PluginParseOptions {
  onProgress?: (message: string) => void;
}

export interface PluginParseResult {
  graph: Graph;
  errors?: AnalysisIssue[];
  warnings?: AnalysisIssue[];
}

/** Controls what the user can do after a plugin renders the graph. */
export interface PluginCapabilities {
  /** Clicking a node opens its source file in a code tab. */
  openFileOnNodeClick: boolean;
  /** User can rename/edit node fields. */
  editNodes: boolean;
  /** User can add new nodes from sidebar. */
  addNodes: boolean;
  /** User can delete nodes. */
  deleteNodes: boolean;
  /** User can draw new connections. */
  addEdges: boolean;
  /** User can delete connections. */
  deleteEdges: boolean;
  /** Save button enabled, saves graph. */
  saveGraph: boolean;
  /** Export AI prompt button enabled. */
  exportPrompt: boolean;
}

/** Result returned by plugin.onNodeClick() */
export interface PluginNodeClickResult {
  filePath: string;
  language?: string;
  scrollTo?: number;
}

/** Serializable info for IPC — no functions. */
export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  nodeTypes: PluginNodeTypeDef[];
  openMode: 'file' | 'folder';
  fileFilters?: Array<{ name: string; extensions: string[] }>;
  canCreateNew: boolean;
  source: 'builtin' | 'user';
  capabilities: PluginCapabilities;
  detectBy?: string[];
}

/** Full plugin interface — main process only (contains functions). */
export interface ArcforgePlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly icon: string;
  readonly nodeTypes: PluginNodeTypeDef[];
  readonly openMode: 'file' | 'folder';
  readonly fileFilters?: Array<{ name: string; extensions: string[] }>;
  readonly canCreateNew: boolean;
  readonly source: 'builtin' | 'user';
  readonly capabilities: PluginCapabilities;
  readonly detectBy?: string[];

  // --- Core ---
  parseProject(entryPath: string, options?: PluginParseOptions): Promise<PluginParseResult>;
  persistGraph?(entryPath: string, graph: Graph): { ok: boolean; error?: string };
  createNew?(filePath: string): { ok: boolean; error?: string };
  isConnectionAllowed(sourceType: string, targetType: string): boolean;
  isDeletable(nodeType: string): boolean;
  getBlueprints?(): unknown[];
  getWatchPatterns?(): string[];
  getInfo(): PluginInfo;

  // --- Full Controller (all optional — Arcforge handles defaults) ---

  /** Re-parse after external file changes. */
  reload?(input: { path: string }): Promise<PluginParseResult>;

  /** Called when user clicks a node. Return filePath to open file in code tab. */
  onNodeClick?(node: { id: string; type: string; filePath?: string; data?: Record<string, unknown> }): Promise<PluginNodeClickResult | null>;

  /** Called when user edits node fields in inspector. */
  onNodeEdit?(node: { id: string; type: string; data?: Record<string, unknown> }, changes: Record<string, unknown>): Promise<{ id: string; label?: string; data?: Record<string, unknown> }>;

  /** Called when user adds a new node from sidebar. */
  onNodeCreate?(type: string, position: { x: number; y: number }): Promise<{ id: string; type: string; position: { x: number; y: number }; label?: string; data?: Record<string, unknown> }>;

  /** Called when user deletes a node. */
  onNodeDelete?(node: { id: string; type: string }): Promise<{ success: boolean; error?: string }>;

  /** Called when user draws a new connection. */
  onEdgeCreate?(source: { id: string; type: string }, target: { id: string; type: string }, edgeType?: string): Promise<{ id: string; source: string; target: string; type?: string }>;

  /** Called when user hits Save. graph = full current { nodes, edges }. */
  onSave?(graph: Graph): Promise<{ success: boolean; error?: string }>;

  /** Called when user hits Export Prompt. Returns AI-ready prompt string. */
  onExport?(graph: Graph, options?: { language?: string; framework?: string; outputType?: string }): Promise<string>;
}
