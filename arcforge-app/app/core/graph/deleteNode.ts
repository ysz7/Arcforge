/**
 * Delete-node logic: which node types are deletable and how to resolve "chain".
 * Used by the main process graph:deleteNode handler.
 */

import type { Graph, GraphEdge } from './types.js';

export type DeleteMode = 'node' | 'flow' | 'chain';

/** Node types that can be deleted (must match main process handler). */
export const DELETABLE_NODE_TYPES = new Set<string>([
  'arch_domain',
  'arch_aggregate',
  'arch_bounded_context',
  'arch_application_service',
  'arch_domain_event',
  'arch_entity',
  'arch_value_object',
  'arch_service',
  'arch_use_case',
  'arch_interface',
  'arch_repository',
  'arch_repository_interface',
  'arch_module',
  'arch_layer',
  'arch_model',
  'arch_view',
  'arch_controller',
  'arch_microservice',
  'arch_event',
  'arch_handler',
  'arch_listener',
  'arch_job',
  'arch_middleware',
  'arch_router',
  'arch_form_request',
  'arch_resource',
  'arch_response',
  'arch_database',
  'arch_entry_interface',
  'arch_eloquent',
  'arch_orm',
  'arch_migration',
  'arch_seeder',
  'arch_factory',
  'arch_di_container',
  'arch_component',
  'arch_entry', // Extra entry nodes (main entry arch:entry cannot be deleted)
]);

/**
 * Returns the set of node ids to remove for deleteNode(nodeId, mode).
 */
export function getNodesToDelete(graph: Graph, nodeId: string, mode: DeleteMode): string[] {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  if (mode === 'node') return [nodeId];

  if (mode === 'flow') {
    const ids = new Set<string>([nodeId]);
    collectDownstream(graph, nodeId, ids);
    return Array.from(ids);
  }

  // chain: node + full downstream
  const ids = new Set<string>([nodeId]);
  collectDownstream(graph, nodeId, ids);
  return Array.from(ids);
}

function collectDownstream(graph: Graph, fromId: string, out: Set<string>): void {
  for (const e of graph.edges) {
    if ((e as GraphEdge).from !== fromId) continue;
    if (out.has((e as GraphEdge).to)) continue;
    out.add((e as GraphEdge).to);
    collectDownstream(graph, (e as GraphEdge).to, out);
  }
}
