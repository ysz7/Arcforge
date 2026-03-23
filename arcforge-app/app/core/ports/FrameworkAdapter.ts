/**
 * Framework adapter port (interface).
 * Isolated per framework; core engine depends only on this abstraction.
 * Future: NestJS, Symfony and other adapters implement the same interface.
 */

import type { Graph, AnalysisResult } from '../graph/types';
import type { GenerateOperation, GenerateResult } from './types';
import type { Blueprint } from '../forge/types';

/** Test runner identifier for adapter (used by PHPUnit/Tasks integration). */
export type TestRunnerId = 'phpunit' | 'pest' | 'jest' | 'vitest';

export interface AnalyzeProgress {
  /** Human-readable status message (shown in UI). */
  message: string;
  /** Overall progress counters (optional). */
  current?: number;
  total?: number;
  /** Optional breakdown for controller indexing. */
  controllersCurrent?: number;
  controllersTotal?: number;
  phase?: 'discover' | 'parsing' | 'building_graph' | 'done';
}

export interface AnalyzeOptions {
  onProgress?: (progress: AnalyzeProgress) => void;
  /** When set (e.g. from "Open JSON" with OpenAPI file), use this file instead of auto-detection. */
  entryFile?: string;
}

export interface FrameworkAdapter {
  /** Unique framework id, e.g. 'laravel' */
  readonly id: string;

  /** Detect if the given project path is this framework. */
  detect(projectPath: string): Promise<boolean>;

  /** Analyze project and return graph with optional issues. */
  analyze(projectPath: string, options?: AnalyzeOptions): Promise<AnalysisResult | Graph>;

  /** Generate code for the given operation (controlled generation only). */
  generate?(operation: GenerateOperation): Promise<GenerateResult>;

  /** Return forge blueprints provided by this adapter (optional). */
  getBlueprints?(): Blueprint[];

  /** File patterns to watch for re-analysis (e.g. ['app/**\/*.php', 'routes/**\/*.php']). */
  getWatchPatterns?(): string[];

  /** Test runner used by this framework (for Run Tests integration). */
  getTestRunner?(): TestRunnerId;
}
