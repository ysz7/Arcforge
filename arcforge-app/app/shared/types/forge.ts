/**
 * Forge types — single source of truth for core and renderer.
 */

import type { GraphNode, GraphEdge } from './graph';

export interface ForgeContext {
  projectPath: string;
  adapterId: string;
  sourceNode: Pick<GraphNode, 'id' | 'type' | 'label' | 'filePath' | 'metadata'>;
  existingNodes: Pick<GraphNode, 'id' | 'type' | 'label' | 'filePath'>[];
  existingEdges: Pick<GraphEdge, 'id' | 'from' | 'to' | 'type'>[];
  params: Record<string, string>;
}

export interface FileConflict {
  filePath: string;
  reason: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflicts: FileConflict[];
}

export type FileMutationType = 'create' | 'append' | 'insert' | 'replace';

export interface FileMutation {
  type: FileMutationType;
  filePath: string;
  content: string;
  description: string;
  marker?: string;
  pattern?: string;
}

export interface GraphMutation {
  newNodes: Array<Pick<GraphNode, 'id' | 'type' | 'filePath' | 'label' | 'metadata'>>;
  newEdges: Array<Pick<GraphEdge, 'id' | 'from' | 'to' | 'type'>>;
}

export interface BlueprintParam {
  name: string;
  label: string;
  required: boolean;
  default?: string;
  deriveFrom?: 'label' | 'metadata';
  metadataKey?: string;
  quickSuggestions?: string[];
  /** Optional category for grouping params in the form (e.g. "Route type", "Group"). */
  category?: string;
}

export interface Blueprint {
  name: string;
  displayName: string;
  description: string;
  /** Category for grouping in Forge UI (e.g. "Templates", "General", "DDD"). */
  category?: string;
  supportedNodeTypes: string[];
  params: BlueprintParam[];
  validate(context: ForgeContext): Promise<ValidationResult>;
  generate(context: ForgeContext): Promise<{ mutations: FileMutation[]; graphMutations: GraphMutation }>;
}

export interface ForgePreview {
  blueprintName: string;
  displayName: string;
  description: string;
  params: Record<string, string>;
  mutations: FileMutation[];
  graphMutations: GraphMutation;
  validation: ValidationResult;
}

export interface ForgeResult {
  success: boolean;
  mutations: FileMutation[];
  graphMutations: GraphMutation;
  backupId: string;
  errors?: string[];
}

export interface BlueprintInfo {
  name: string;
  displayName: string;
  description: string;
  category?: string;
  supportedNodeTypes: string[];
  params: BlueprintParam[];
}

export interface ForgeFileDiff {
  filePath: string;
  original: string;
  modified: string;
  isNew: boolean;
}
