/**
 * Zustand store for Forge Mode state (renderer).
 * Manages the forge modal flow: select → params → preview → execute.
 */

import { create } from 'zustand';
import type { ForgeBlueprintInfo, ForgePreview, ForgeResult } from '../global';

export type ForgeStep =
  | 'closed'
  | 'select'
  | 'params'
  | 'preview'
  | 'executing'
  | 'done';

export interface ForgeSourceNode {
  id: string;
  type: string;
  label: string;
  filePath: string;
  metadata?: Record<string, unknown>;
}

interface ForgeState {
  step: ForgeStep;
  sourceNode: ForgeSourceNode | null;
  blueprints: ForgeBlueprintInfo[];
  selectedBlueprint: ForgeBlueprintInfo | null;
  params: Record<string, string>;
  preview: ForgePreview | null;
  result: ForgeResult | null;
  error: string | null;

  /** Open the forge menu for a specific node. */
  openForge: (node: ForgeSourceNode) => void;
  /** Set available blueprints after fetching. */
  setBlueprints: (blueprints: ForgeBlueprintInfo[]) => void;
  /** Select a blueprint and move to params step. */
  selectBlueprint: (bp: ForgeBlueprintInfo) => void;
  /** Update a single param value. */
  setParam: (name: string, value: string) => void;
  /** Set all params at once. */
  setParams: (params: Record<string, string>) => void;
  /** Move to preview step. */
  goToPreview: () => void;
  /** Set preview result from IPC. */
  setPreview: (preview: ForgePreview) => void;
  /** Start execution. */
  startExecuting: () => void;
  /** Set execution result. */
  setResult: (result: ForgeResult) => void;
  /** Set error. */
  setError: (error: string) => void;
  /** Go back one step. */
  goBack: () => void;
  /** Close forge modal and reset state. */
  closeForge: () => void;
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  step: 'closed',
  sourceNode: null,
  blueprints: [],
  selectedBlueprint: null,
  params: {},
  preview: null,
  result: null,
  error: null,

  openForge: (node) => {
    set({
      step: 'select',
      sourceNode: node,
      blueprints: [],
      selectedBlueprint: null,
      params: {},
      preview: null,
      result: null,
      error: null,
    });
  },

  setBlueprints: (blueprints) => set({ blueprints }),

  selectBlueprint: (bp) => {
    const { sourceNode } = get();
    const params: Record<string, string> = {};
    for (const p of bp.params) {
      if (p.deriveFrom === 'label' && sourceNode) {
        params[p.name] = sourceNode.label;
      } else if (p.deriveFrom === 'metadata' && p.metadataKey && sourceNode?.metadata) {
        const val = sourceNode.metadata[p.metadataKey];
        if (typeof val === 'string') params[p.name] = val;
      }
      if (!params[p.name] && p.default) {
        params[p.name] = p.default;
      }
    }
    set({ step: 'params', selectedBlueprint: bp, params });
  },

  setParam: (name, value) =>
    set((s) => ({ params: { ...s.params, [name]: value } })),

  setParams: (params) => set({ params }),

  goToPreview: () => set({ step: 'preview', preview: null, error: null }),

  setPreview: (preview) => set({ preview }),

  startExecuting: () => set({ step: 'executing' }),

  setResult: (result) => set({ step: 'done', result }),

  setError: (error) => set({ error }),

  goBack: () => {
    const { step } = get();
    if (step === 'params') set({ step: 'select', selectedBlueprint: null });
    else if (step === 'preview') set({ step: 'params', preview: null, error: null });
    else if (step === 'done') set({ step: 'preview' });
  },

  closeForge: () =>
    set({
      step: 'closed',
      sourceNode: null,
      blueprints: [],
      selectedBlueprint: null,
      params: {},
      preview: null,
      result: null,
      error: null,
    }),
}));
