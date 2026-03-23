/**
 * Arcforge Plugin SDK — helper utilities for plugin authors.
 *
 * Built-in usage:  const sdk = require('../arcforge-sdk')
 * User plugin:     const sdk = require('../arcforge-sdk')   // from ~/Documents/Arcforge/Plugins/my-plugin/
 *
 * The SDK is a standalone file — no Arcforge internals, only Node.js built-ins.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SdkNode {
  id: string;
  type: string;
  filePath?: string;
  position?: { x: number; y: number };
  data: {
    name: string;
    description?: string;
    [key: string]: unknown;
  };
}

export interface SdkEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export type EdgeType =
  | 'calls'
  | 'implements'
  | 'emits'
  | 'listens'
  | 'dispatches'
  | 'reads'
  | 'writes'
  | 'depends on'
  | 'maps';

export interface NodeOptions {
  filePath?: string;
  position?: { x: number; y: number };
  description?: string;
  [key: string]: unknown;
}

export interface WalkOptions {
  /** File extensions to include, e.g. ['.php', '.ts']. All files if omitted. */
  extensions?: string[];
  /** Directory names to skip. Default: ['node_modules', 'vendor', '.git'] */
  ignore?: string[];
  /** Max depth. Default: unlimited */
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// uid — generate a short unique id
// ---------------------------------------------------------------------------

export function uid(prefix?: string): string {
  const short = crypto.randomBytes(4).toString('hex');
  return prefix ? `${prefix}_${short}` : short;
}

// ---------------------------------------------------------------------------
// node — create a node object
// ---------------------------------------------------------------------------

export function node(type: string, name: string, options?: NodeOptions): SdkNode {
  const { filePath, position, description, ...rest } = options ?? {};
  return {
    id: uid(type.toLowerCase().replace(/\s+/g, '_')),
    type,
    ...(filePath ? { filePath } : {}),
    ...(position ? { position } : {}),
    data: {
      name,
      ...(description ? { description } : {}),
      ...rest,
    },
  };
}

// ---------------------------------------------------------------------------
// edge — create an edge object
// ---------------------------------------------------------------------------

export function edge(type: EdgeType | string, sourceId: string, targetId: string): SdkEdge {
  return {
    id: uid('edge'),
    source: sourceId,
    target: targetId,
    type,
  };
}

// ---------------------------------------------------------------------------
// readFile — safely read a file as UTF-8 string
// ---------------------------------------------------------------------------

export function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// readDir — list entries in a directory
// ---------------------------------------------------------------------------

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export function readDir(dirPath: string): DirEntry[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// walkDir — recursively collect file paths
// ---------------------------------------------------------------------------

export function walkDir(dirPath: string, options?: WalkOptions): string[] {
  const ignore = new Set(options?.ignore ?? ['node_modules', 'vendor', '.git', '.arcforge']);
  const maxDepth = options?.maxDepth ?? Infinity;
  const extensions = options?.extensions ? new Set(options.extensions) : null;

  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else {
        if (extensions && !extensions.has(path.extname(entry.name))) continue;
        results.push(fullPath);
      }
    }
  }

  walk(dirPath, 0);
  return results;
}

// ---------------------------------------------------------------------------
// exists — check if file/dir exists
// ---------------------------------------------------------------------------

export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ---------------------------------------------------------------------------
// basename / extname / dirname — re-exports for convenience
// ---------------------------------------------------------------------------

export const basename = path.basename;
export const extname = path.extname;
export const dirname = path.dirname;
export const joinPath = path.join;

module.exports = {
  uid,
  node,
  edge,
  readFile,
  readDir,
  walkDir,
  exists,
  basename,
  extname,
  dirname,
  joinPath,
};
