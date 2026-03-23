/**
 * Ports — interfaces for adapters and external concerns.
 * Core engine depends on these; adapters implement them.
 */

export type { GenerateOperation, GenerateResult, GenerateOperationKind } from './types';
export type { FrameworkAdapter } from './FrameworkAdapter';
