/**
 * Architecture adapter — visual backend architecture design.
 * User creates nodes (domain, module, service, etc.) and connects them.
 * Graph is persisted to a single JSON file for AI-assisted code generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkAdapter } from '../../ports';
import type { Blueprint } from '../../forge/types';
import type { Graph, GraphNode, GraphEdge } from '../../graph/types';
import type { AnalyzeOptions } from '../../ports/FrameworkAdapter';
import { createLogger } from '../../utils/logger';
import { ARCH_ADD_NODE_BLUEPRINTS } from './blueprints/AddArchNodeBlueprints';
import { ARCH_TEMPLATE_BLUEPRINTS } from './blueprints/ArchitectureTemplateBlueprints';
import {
  isArchitectureDocument,
  ARCFORGE_ARCHITECTURE_VERSION,
  type ArchitectureDocument,
} from './types';

const log = createLogger('ArchitectureAdapter');

export class ArchitectureAdapter implements FrameworkAdapter {
  readonly id = 'arcspec';

  constructor(private readonly entryFilePath: string) {}

  async detect(_projectPath: string): Promise<boolean> {
    return false;
  }

  async analyze(projectPath: string, options?: AnalyzeOptions): Promise<Graph> {
    const onProgress = options?.onProgress;
    const rel = path.relative(projectPath, this.entryFilePath).replace(/\\/g, '/');

    onProgress?.({ message: 'Reading architecture…', phase: 'parsing' });

    let doc: ArchitectureDocument;
    try {
      const content = fs.readFileSync(this.entryFilePath, 'utf8');
      const parsed = JSON.parse(content);
      if (!isArchitectureDocument(parsed)) {
        log.warn('Invalid architecture document', { filePath: this.entryFilePath });
        return { nodes: [], edges: [] };
      }
      doc = parsed;
    } catch (err) {
      log.error('Failed to read architecture file', {
        filePath: this.entryFilePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return { nodes: [], edges: [] };
    }

    const nodes: GraphNode[] = doc.nodes.map((n) => ({
      id: n.id,
      type: n.type as GraphNode['type'],
      filePath: rel,
      label: n.label ?? '',
      metadata: n.metadata ?? {},
    }));

    const edges: GraphEdge[] = doc.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      type: (e.type as GraphEdge['type']) ?? 'dependency',
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      metadata: e.metadata,
    }));

    onProgress?.({ message: 'Architecture graph built', phase: 'building_graph', total: nodes.length });

    return { nodes, edges };
  }

  getWatchPatterns(): string[] {
    return ['*.json'];
  }

  getBlueprints(): Blueprint[] {
    return [...ARCH_ADD_NODE_BLUEPRINTS, ...ARCH_TEMPLATE_BLUEPRINTS];
  }
}

/** Persist graph to architecture JSON file. */
export function persistArchitectureToFile(
  filePath: string,
  graph: Graph
): { ok: boolean; error?: string } {
  try {
    const doc: ArchitectureDocument = {
      arcforge: 'arcforge:architecture' as const,
      version: ARCFORGE_ARCHITECTURE_VERSION,
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        metadata: n.metadata ?? {},
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        type: e.type,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        metadata: e.metadata,
      })),
    };
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('Failed to persist architecture', { filePath, error: msg });
    return { ok: false, error: msg };
  }
}
