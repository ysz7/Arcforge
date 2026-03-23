/**
 * ArcSpec plugin parser — full controller for architecture graphs.
 * Exports all plugin methods consumed by Arcforge's loadManifestPlugin() loader.
 *
 * This file is compiled alongside Arcforge (tsc) so it can import from core/.
 * User plugins cannot do this — they must use Node.js built-ins only.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ArchitectureAdapter, persistArchitectureToFile } from './adapter';
import { createEmptyArchitecture } from './types';
import { ARCHITECTURE_CONNECTION_RULES } from './connectionRules';
import { ARCSPEC_NODE_TYPES } from './nodeTypes';

const DELETABLE_TYPES = new Set(
  ARCSPEC_NODE_TYPES.filter((t) => t.deletable).map((t) => t.id)
);

// ---------------------------------------------------------------------------
// parse — initial project load
// ---------------------------------------------------------------------------

export async function parse(input: { path: string }): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  const adapter = new ArchitectureAdapter(input.path);
  const projectPath = path.dirname(input.path);
  const graph = await adapter.analyze(projectPath, {});
  return { nodes: graph.nodes, edges: graph.edges };
}

// ---------------------------------------------------------------------------
// reload — re-parse after external file changes
// ---------------------------------------------------------------------------

export async function reload(input: { path: string }): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  return parse(input);
}

// ---------------------------------------------------------------------------
// persistGraph — save graph back to the .json file
// ---------------------------------------------------------------------------

export function persistGraph(entryPath: string, graph: { nodes: unknown[]; edges: unknown[] }): { ok: boolean; error?: string } {
  return persistArchitectureToFile(entryPath, graph as Parameters<typeof persistArchitectureToFile>[1]);
}

// ---------------------------------------------------------------------------
// createNew — create an empty architecture file
// ---------------------------------------------------------------------------

export function createNew(filePath: string): { ok: boolean; error?: string } {
  try {
    const doc = createEmptyArchitecture();
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// isConnectionAllowed
// ---------------------------------------------------------------------------

export function isConnectionAllowed(sourceType: string, targetType: string): boolean {
  const allowedMap = ARCHITECTURE_CONNECTION_RULES.allowed;
  if (!allowedMap) return false;
  const allowed = allowedMap[sourceType];
  if (!allowed) return false;
  return (allowed as readonly string[]).includes(targetType);
}

// ---------------------------------------------------------------------------
// isDeletable
// ---------------------------------------------------------------------------

export function isDeletable(nodeType: string): boolean {
  return DELETABLE_TYPES.has(nodeType);
}

// ---------------------------------------------------------------------------
// getBlueprints — returns Blueprint[] for ForgeEngine
// ---------------------------------------------------------------------------

export function getBlueprints(): unknown[] {
  const adapter = new ArchitectureAdapter('');
  return adapter.getBlueprints?.() ?? [];
}

// ---------------------------------------------------------------------------
// getWatchPatterns
// ---------------------------------------------------------------------------

export function getWatchPatterns(): string[] {
  return ['*.json'];
}

// ---------------------------------------------------------------------------
// onSave — called when user hits Save
// ---------------------------------------------------------------------------

export async function onSave(
  graph: { nodes: unknown[]; edges: unknown[] },
  context: { entryPath?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!context?.entryPath) return { success: false, error: 'No entry path' };
  const res = persistGraph(context.entryPath, graph);
  return { success: res.ok, error: res.error };
}

// ---------------------------------------------------------------------------
// onExport — generate AI prompt from graph
// ---------------------------------------------------------------------------

export async function onExport(
  graph: { nodes: Array<{ id: string; type: string; label: string; metadata?: Record<string, unknown> }>; edges: Array<{ from: string; to: string; type?: string }> }
): Promise<string> {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const lines: string[] = ['# Architecture Graph\n'];

  for (const node of graph.nodes) {
    lines.push(`## ${node.type}: ${node.label}`);
    const deps = graph.edges
      .filter((e) => e.from === node.id)
      .map((e) => nodeById.get(e.to)?.label ?? e.to);
    if (deps.length > 0) {
      lines.push(`Depends on: ${deps.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
