/**
 * Core analysis engine: orchestrates detection, analysis, and graph updates.
 * Depends on ports (FrameworkAdapter) and graph store; no UI or Electron.
 */

import type { FrameworkAdapter } from '../ports';
import { createLogger } from '../utils/logger';
import type { AnalyzeProgress } from '../ports/FrameworkAdapter';

const log = createLogger('AnalysisEngine');
import { GraphStore } from '../graph/store';
import { ForgeEngine } from '../forge/ForgeEngine';
import { ProjectDetector } from './ProjectDetector';
import { ArchitectureAdapter } from '../frameworks/architecture/ArchitectureAdapter';
import * as path from 'path';
import { FileWatcher, type FileWatcherCallback } from './FileWatcher';

export interface AnalysisEngineOptions {
  adapters: FrameworkAdapter[];
  /** File patterns to watch for re-analysis (framework-specific). */
  watchPatterns?: string[];
}

export type GraphUpdateListener = (projectPath: string, adapterId: string) => void;
export type AnalysisStatusListener = (status: AnalyzeProgress) => void;

export class AnalysisEngine {
  private readonly store: GraphStore;
  private readonly detector: ProjectDetector;
  private readonly adapters: FrameworkAdapter[];
  private readonly watchPatterns: string[];
  private readonly forge: ForgeEngine;
  private activeAdapter: FrameworkAdapter | null = null;
  private entryFile: string | null = null;
  private fileWatcher: FileWatcher | null = null;
  private graphUpdateListeners: GraphUpdateListener[] = [];
  private statusListeners: AnalysisStatusListener[] = [];
  private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isAnalyzing = false;
  private pendingRefresh = false;

  constructor(options: AnalysisEngineOptions) {
    this.adapters = options.adapters;
    this.watchPatterns = options.watchPatterns ?? [];
    this.store = new GraphStore();
    this.detector = new ProjectDetector(options.adapters);
    this.forge = new ForgeEngine();
  }

  getGraphStore(): GraphStore {
    return this.store;
  }

  getForgeEngine(): ForgeEngine {
    return this.forge;
  }

  onGraphUpdate(listener: GraphUpdateListener): () => void {
    this.graphUpdateListeners.push(listener);
    return () => {
      this.graphUpdateListeners = this.graphUpdateListeners.filter((l) => l !== listener);
    };
  }

  onStatusUpdate(listener: AnalysisStatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyGraphUpdate(): void {
    const path = this.store.getProjectPath();
    const adapterId = this.activeAdapter?.id ?? '';
    this.graphUpdateListeners.forEach((l) => l(path, adapterId));
  }

  private emitStatus(status: AnalyzeProgress): void {
    this.statusListeners.forEach((l) => l(status));
  }

  /** Open a project folder: detect framework and run initial analysis. */
  async openProject(
    projectPath: string,
    options?: { entryFile?: string }
  ): Promise<{ adapterId: string | null; error?: string }> {
    const start = Date.now();
    log.info('Opening project', { projectPath });
    this.closeProject();
    const adapter = await this.detector.detect(projectPath);
    if (!adapter) {
      log.warn('No supported framework detected', { projectPath });
      return { adapterId: null, error: 'No supported framework detected' };
    }
    this.activeAdapter = adapter;
    this.entryFile = options?.entryFile ?? null;
    this.store.setProjectPath(projectPath);
    log.info('Framework detected', { adapterId: adapter.id });

    // Register forge blueprints from the adapter
    this.forge.registry.clear();
    if (adapter.getBlueprints) {
      for (const bp of adapter.getBlueprints()) {
        this.forge.registry.register(bp);
      }
    }

    try {
      const result = await adapter.analyze(projectPath, {
        onProgress: (p) => this.emitStatus(p),
        entryFile: options?.entryFile,
      });
      const graph = 'graph' in result ? result.graph : result;
      const issues =
        'errors' in result
          ? [...(result.errors ?? []), ...(result.warnings ?? [])]
          : [];
      this.store.setGraph(graph);
      this.store.setAnalysisIssues(issues);
      this.notifyGraphUpdate();
      log.info('Analysis complete', { nodes: graph.nodes.length, edges: graph.edges.length, issues: issues.length, ms: Date.now() - start });
      this.emitStatus({ message: 'Indexing complete', phase: 'done' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('Analysis failed', { error, ms: Date.now() - start });
      this.emitStatus({ message: `Indexing failed: ${error}` });
      return { adapterId: adapter.id, error };
    }
    const patterns = adapter.getWatchPatterns?.() ?? this.watchPatterns;
    this.startWatching(projectPath, patterns);
    return { adapterId: adapter.id };
  }

  /** Re-run analysis (e.g. after file change). */
  async refresh(): Promise<void> {
    await this.refreshNow();
  }

  /**
   * Open an architecture JSON file (Create new / Open architecture).
   * Uses ArchitectureAdapter; graph is user-editable and persisted to the file.
   */
  async openArchitectureFile(filePath: string): Promise<{ adapterId: string | null; error?: string }> {
    const start = Date.now();
    log.info('Opening architecture file', { filePath });
    this.closeProject();

    const projectPath = path.dirname(filePath);
    this.store.setProjectPath(projectPath);
    this.entryFile = filePath;

    const adapter = new ArchitectureAdapter(filePath);
    this.activeAdapter = adapter;

    this.forge.registry.clear();
    if (adapter.getBlueprints) {
      for (const bp of adapter.getBlueprints()) {
        this.forge.registry.register(bp);
      }
    }

    try {
      const graph = await adapter.analyze(projectPath, {
        onProgress: (p) => this.emitStatus(p),
      });
      this.store.setGraph(graph);
      this.store.setAnalysisIssues([]);
      this.notifyGraphUpdate();
      log.info('Architecture load complete', {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        ms: Date.now() - start,
      });
      this.emitStatus({ message: 'Indexing complete', phase: 'done' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('Architecture load failed', { error, ms: Date.now() - start });
      this.emitStatus({ message: `Load failed: ${error}` });
      return { adapterId: adapter.id, error };
    }

    const patterns = adapter.getWatchPatterns?.() ?? ['*.json'];
    this.startWatching(projectPath, patterns);
    return { adapterId: adapter.id };
  }

  /** Debounced refresh (for file watcher and rapid events). */
  scheduleRefresh(debounceMs: number = 300): void {
    if (this.refreshDebounceTimer) clearTimeout(this.refreshDebounceTimer);
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshDebounceTimer = null;
      void this.refreshNow();
    }, debounceMs);
  }

  private async refreshNow(): Promise<void> {
    const path = this.store.getProjectPath();
    if (!path || !this.activeAdapter) return;
    if (this.isAnalyzing) {
      this.pendingRefresh = true;
      return;
    }
    this.isAnalyzing = true;
    const start = Date.now();
    try {
      this.emitStatus({ message: 'Refreshing index…', phase: 'discover' });
      const result = await this.activeAdapter.analyze(path, {
        onProgress: (p) => this.emitStatus(p),
        entryFile: this.entryFile ?? undefined,
      });
      const graph = 'graph' in result ? result.graph : result;
      const issues =
        'errors' in result
          ? [...(result.errors ?? []), ...(result.warnings ?? [])]
          : [];
      this.store.setGraph(graph);
      this.store.setAnalysisIssues(issues);
      this.notifyGraphUpdate();
      log.debug('Refresh complete', { nodes: graph.nodes.length, ms: Date.now() - start });
      this.emitStatus({ message: 'Refresh complete', phase: 'done' });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('Refresh failed', { error, ms: Date.now() - start });
      this.emitStatus({ message: `Refresh failed: ${error}` });
      // Keep previous graph on transient errors
    } finally {
      this.isAnalyzing = false;
      if (this.pendingRefresh) {
        this.pendingRefresh = false;
        // Throttle burst of changes into one extra refresh.
        this.scheduleRefresh(250);
      }
    }
  }

  private startWatching(projectPath: string, patterns?: string[]): void {
    const onEvent: FileWatcherCallback = () => {
      this.scheduleRefresh(350);
    };
    const watchPatterns = patterns ?? this.watchPatterns;
    this.fileWatcher = new FileWatcher(
      { projectPath, patterns: watchPatterns, debounceMs: 400 },
      onEvent
    );
    this.fileWatcher.start();
  }

  closeProject(): void {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
    if (this.fileWatcher) {
      this.fileWatcher.stop();
      this.fileWatcher = null;
    }
    this.activeAdapter = null;
    this.entryFile = null;
    this.store.setGraph({ nodes: [], edges: [] });
    this.store.setProjectPath('');
  }

  getActiveAdapterId(): string | null {
    return this.activeAdapter?.id ?? null;
  }

  getEntryFile(): string | null {
    return this.entryFile;
  }
}
