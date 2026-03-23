/**
 * Port types for controlled code generation (future stage).
 * Editing is only through controlled code generation, not arbitrary bidirectional sync.
 */

import type { Graph } from '../graph/types';

export type GenerateOperationKind = 'create_controller' | 'create_service' | 'create_route' | 'wire_di';

export interface GenerateOperation {
  kind: GenerateOperationKind;
  payload: Record<string, unknown>;
}

export interface GenerateResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
