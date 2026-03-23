/**
 * IPC API exposed by Electron preload (contextBridge).
 * Types imported from shared.
 */

import type {
  ArcforgeAPI,
  ArcforgeGraph,
  ForgeBlueprintInfo,
  ForgeFileMutation,
  ForgeGraphMutation,
  ForgeValidation,
  ForgePreviewIPC,
  ForgeResultIPC,
  ForgeFileDiff,
} from '../../shared/types';

export type {
  ArcforgeGraph,
  ForgeBlueprintInfo,
  ForgeFileMutation,
  ForgeGraphMutation,
  ForgeValidation,
  ForgePreview,
  ForgeResult,
  ForgeFileDiff,
};

export type ForgePreview = ForgePreviewIPC;
export type ForgeResult = ForgeResultIPC;

declare global {
  interface Window {
    arcforge?: ArcforgeAPI;
  }
}

export {};
