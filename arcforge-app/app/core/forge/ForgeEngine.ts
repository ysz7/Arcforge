/**
 * Forge Engine — orchestrates blueprint validation, preview, and execution.
 * Framework-agnostic; delegates to registered blueprints.
 */

import { createLogger } from '../utils/logger';
import { BlueprintRegistry } from './BlueprintRegistry';
import { FileMutationLayer } from './FileMutationLayer';
import type {
  Blueprint,
  BlueprintInfo,
  ForgeContext,
  ForgePreview,
  ForgeResult,
} from './types';

const log = createLogger('ForgeEngine');

export class ForgeEngine {
  readonly registry: BlueprintRegistry;
  private readonly fileMutation: FileMutationLayer;

  constructor() {
    this.registry = new BlueprintRegistry();
    this.fileMutation = new FileMutationLayer();
  }

  /* ----- Query ---------------------------------------------------- */

  /** Get serializable blueprint list for a given node type. */
  getBlueprintsForNodeType(nodeType: string): BlueprintInfo[] {
    return this.registry.getInfoForNodeType(nodeType);
  }

  /* ----- Preview (dry-run) ---------------------------------------- */

  async preview(blueprintName: string, context: ForgeContext): Promise<ForgePreview> {
    log.debug('Preview', { blueprintName, sourceNodeId: context.sourceNode.id });
    const bp = this.requireBlueprint(blueprintName);

    // Auto-derive params
    const resolvedParams = this.resolveParams(bp, context);
    const ctx: ForgeContext = { ...context, params: resolvedParams };

    const validation = await bp.validate(ctx);
    let mutations: ForgePreview['mutations'] = [];
    let graphMutations: ForgePreview['graphMutations'] = { newNodes: [], newEdges: [] };

    if (validation.valid) {
      const generated = await bp.generate(ctx);
      mutations = generated.mutations;
      graphMutations = generated.graphMutations;
    }

    return {
      blueprintName: bp.name,
      displayName: bp.displayName,
      description: bp.description,
      params: resolvedParams,
      mutations,
      graphMutations,
      validation,
    };
  }

  /* ----- Execute -------------------------------------------------- */

  async execute(blueprintName: string, context: ForgeContext): Promise<ForgeResult> {
    log.info('Execute', { blueprintName, sourceNodeId: context.sourceNode.id });
    const bp = this.requireBlueprint(blueprintName);

    const resolvedParams = this.resolveParams(bp, context);
    const ctx: ForgeContext = { ...context, params: resolvedParams };

    // Validate first
    const validation = await bp.validate(ctx);
    if (!validation.valid) {
      log.warn('Validation failed', { blueprintName, errors: validation.errors });
      return {
        success: false,
        mutations: [],
        graphMutations: { newNodes: [], newEdges: [] },
        backupId: '',
        errors: validation.errors,
      };
    }

    // Generate mutations
    const { mutations, graphMutations } = await bp.generate(ctx);

    // Apply mutations with backup
    const backupId = this.fileMutation.apply(ctx.projectPath, mutations);
    log.info('Execute complete', { blueprintName, backupId, mutationsCount: mutations.length });

    return {
      success: true,
      mutations,
      graphMutations,
      backupId,
    };
  }

  /* ----- Rollback / Confirm --------------------------------------- */

  rollback(backupId: string): void {
    this.fileMutation.rollback(backupId);
  }

  /** Discard backup without rollback (user confirmed "Keep"). */
  confirmPending(backupId: string): void {
    this.fileMutation.discardBackup(backupId);
  }

  /** Confirm a single file (keep its changes, remove from backup). */
  confirmPendingFile(backupId: string, filePath: string): void {
    this.fileMutation.confirmPendingFile(backupId, filePath);
  }

  /** Rollback a single file (restore original). */
  rollbackFile(backupId: string, filePath: string, projectPath: string): void {
    this.fileMutation.rollbackFile(backupId, filePath, projectPath);
  }

  /** Get before/after diffs for a pending execution. */
  getDiffs(backupId: string, projectPath: string) {
    return this.fileMutation.getDiffs(backupId, projectPath);
  }

  /* ----- Helpers -------------------------------------------------- */

  /** Check file existence (used by blueprints during validation). */
  fileExists(projectPath: string, relativePath: string): boolean {
    return this.fileMutation.fileExists(projectPath, relativePath);
  }

  /** Read file content (used by blueprints for insert mutations). */
  readFile(projectPath: string, relativePath: string): string | null {
    return this.fileMutation.readFile(projectPath, relativePath);
  }

  private requireBlueprint(name: string): Blueprint {
    const bp = this.registry.get(name);
    if (!bp) throw new Error(`Blueprint not found: ${name}`);
    return bp;
  }

  /** Auto-fill parameters from source node when deriveFrom is set. */
  private resolveParams(bp: Blueprint, context: ForgeContext): Record<string, string> {
    const result = { ...context.params };
    for (const p of bp.params) {
      if (result[p.name]) continue; // User already provided
      if (p.deriveFrom === 'label') {
        result[p.name] = context.sourceNode.label;
      } else if (p.deriveFrom === 'metadata' && p.metadataKey) {
        const val = context.sourceNode.metadata?.[p.metadataKey];
        if (typeof val === 'string') result[p.name] = val;
      }
      if (!result[p.name] && p.default) {
        result[p.name] = p.default;
      }
    }
    return result;
  }
}
