/**
 * Architecture JSON format — identifier block at top so other adapters don't parse it.
 * Used for visual backend architecture design (MVC, DDD, Microservices, etc.).
 */

export const ARCFORGE_ARCHITECTURE_MAGIC = 'arcforge:architecture';
export const ARCFORGE_ARCHITECTURE_VERSION = '1.0';

export interface ArchitectureNodeData {
  id: string;
  type: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface ArchitectureEdgeData {
  id: string;
  from: string;
  to: string;
  type: string;
  sourceHandle?: string;
  targetHandle?: string;
  metadata?: Record<string, unknown>;
}

export interface ArchitectureDocument {
  arcforge: typeof ARCFORGE_ARCHITECTURE_MAGIC;
  version: string;
  nodes: ArchitectureNodeData[];
  edges: ArchitectureEdgeData[];
}

export function isArchitectureDocument(obj: unknown): obj is ArchitectureDocument {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return o.arcforge === ARCFORGE_ARCHITECTURE_MAGIC && Array.isArray(o.nodes) && Array.isArray(o.edges);
}

export function createEmptyArchitecture(): ArchitectureDocument {
  return {
    arcforge: ARCFORGE_ARCHITECTURE_MAGIC,
    version: ARCFORGE_ARCHITECTURE_VERSION,
    nodes: [
      {
        id: 'arch:entry',
        type: 'arch_entry',
        label: 'Entry',
        metadata: {},
      },
    ],
    edges: [],
  };
}
