/**
 * File system watcher for project directory.
 * Emits events so the engine can re-run analysis on change.
 */

import chokidar from 'chokidar';

export type FileWatcherEvent = 'add' | 'change' | 'unlink';

export interface FileWatcherOptions {
  projectPath: string;
  /** Glob patterns relative to projectPath, e.g. ['app/**\/*.php', 'routes/**\/*.php'] */
  patterns: string[];
  /** Debounce delay in ms before emitting */
  debounceMs?: number;
}

export type FileWatcherCallback = (event: FileWatcherEvent, path: string) => void;

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(
    private readonly options: FileWatcherOptions,
    private readonly onEvent: FileWatcherCallback
  ) {
    this.debounceMs = options.debounceMs ?? 300;
  }

  start(): void {
    if (this.watcher) return;
    const { projectPath, patterns } = this.options;
    const fullPatterns = patterns.map((p) => `${projectPath}/${p.replace(/^\//, '')}`);
    this.watcher = chokidar.watch(fullPatterns, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100 },
    });
    this.watcher.on('all', (event: string, path: string) => {
      const e = event === 'add' ? 'add' : event === 'change' ? 'change' : 'unlink';
      this.debounce(() => this.onEvent(e, path));
    });
  }

  private debounce(fn: () => void): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      fn();
    }, this.debounceMs);
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
