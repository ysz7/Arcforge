/**
 * Shared types — single source of truth for core and renderer.
 */

export * from './graph';
export * from '../allowedConnections';
export * from './forge';
export {
  ArcforgeGraph,
  ForgeFileMutation,
  ForgeGraphMutation,
  ForgeValidation,
  ForgeBlueprintInfo,
  ForgePreviewIPC,
  ForgeResultIPC,
  ArcforgeAPI,
  AnalysisStatus,
  GitFileStatus,
  TestResult,
} from './ipc';
export type { PluginNodeTypeDef, PluginInfo, PluginParseOptions, PluginParseResult, ArcforgePlugin } from './plugin';
