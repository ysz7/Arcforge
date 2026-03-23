/**
 * Arcforge Plugin Type Definitions
 *
 * Copy this file into your plugin folder for full IntelliSense support.
 * Rename to arcforge-sdk.d.ts if using the SDK helpers.
 *
 * Usage in parser.js:
 *   // @ts-check
 *   /// <reference path="./arcforge.d.ts" />
 */

// ---------------------------------------------------------------------------
// SDK helpers (arcforge-sdk.js)
// ---------------------------------------------------------------------------

export interface SdkNode {
  id: string;
  type: string;
  filePath?: string;
  position?: { x: number; y: number };
  data: { name: string; description?: string; [key: string]: unknown };
}

export interface SdkEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export type EdgeType =
  | 'calls' | 'implements' | 'emits' | 'listens'
  | 'dispatches' | 'reads' | 'writes' | 'depends on' | 'maps';

export interface NodeOptions {
  filePath?: string;
  position?: { x: number; y: number };
  description?: string;
  [key: string]: unknown;
}

export interface WalkOptions {
  extensions?: string[];
  ignore?: string[];
  maxDepth?: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

/** Generate a short unique id. Prefix optional: uid('ctrl') → 'ctrl_a3f2b1' */
export function uid(prefix?: string): string;

/** Create a node. type must match a type from nodes.js or a built-in type. */
export function node(type: string, name: string, options?: NodeOptions): SdkNode;

/** Create an edge between two nodes. */
export function edge(type: EdgeType | string, sourceId: string, targetId: string): SdkEdge;

/** Read a file as UTF-8 string. Returns null on error. */
export function readFile(filePath: string): string | null;

/** List files and folders in a directory. */
export function readDir(dirPath: string): DirEntry[];

/** Recursively collect file paths under a directory. */
export function walkDir(dirPath: string, options?: WalkOptions): string[];

/** Check if a file or directory exists. */
export function exists(filePath: string): boolean;

export const basename: (p: string, ext?: string) => string;
export const extname: (p: string) => string;
export const dirname: (p: string) => string;
export const joinPath: (...paths: string[]) => string;

// ---------------------------------------------------------------------------
// parser.js exports
// ---------------------------------------------------------------------------

export interface ParseInput {
  /** Absolute path to the folder or file the user selected. */
  path: string;
}

export interface ParseResult {
  nodes: SdkNode[];
  edges: SdkEdge[];
}

export interface NodeClickResult {
  filePath: string;
  /** Syntax highlighting hint, e.g. 'php', 'typescript'. */
  language?: string;
  /** Scroll to this line number in the editor. */
  scrollTo?: number;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// manifest.json shape
// ---------------------------------------------------------------------------

export interface Manifest {
  /** Unique plugin id. Used as folder name in Plugins/. */
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** Single emoji or text icon shown in the plugin picker. */
  icon?: string;
  /** Path to parser.js (relative to plugin folder). */
  parser: string;
  /** Path to nodes.js (optional). */
  nodes?: string;
  /** 'directory' = folder picker | 'file' = file picker */
  accepts: 'directory' | 'file';
  /** File extensions for file picker, e.g. ['.json', '.yaml'] */
  fileTypes?: string[];
  canCreateNew?: boolean;
  /** File/dir names to auto-detect this plugin (e.g. ['artisan', 'composer.json']) */
  detectBy?: string[];
  capabilities?: {
    openFileOnNodeClick?: boolean;
    editNodes?: boolean;
    addNodes?: boolean;
    deleteNodes?: boolean;
    addEdges?: boolean;
    deleteEdges?: boolean;
    saveGraph?: boolean;
    exportPrompt?: boolean;
  };
}

// ---------------------------------------------------------------------------
// nodes.js shape — array of custom node type definitions
// ---------------------------------------------------------------------------

export interface NodeTypeDef {
  /** Unique type id. Used as `type` in nodes returned from parse(). */
  id: string;
  label: string;
  description?: string;
  /** Hex color, e.g. '#4a9eff' */
  color?: string;
  /** Single char / emoji icon */
  icon?: string;
  deletable?: boolean;
  renameable?: boolean;
  openable?: boolean;
}
