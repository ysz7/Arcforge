/**
 * Forge — intent-based architecture blueprint generator.
 * Core types, registry, engine, and file mutation layer.
 */

export { ForgeEngine } from './ForgeEngine';
export { BlueprintRegistry } from './BlueprintRegistry';
export { FileMutationLayer } from './FileMutationLayer';
export type {
  Blueprint,
  BlueprintInfo,
  BlueprintParam,
  ForgeContext,
  ForgePreview,
  ForgeResult,
  FileMutation,
  FileMutationType,
  GraphMutation,
  ValidationResult,
  FileConflict,
} from './types';
