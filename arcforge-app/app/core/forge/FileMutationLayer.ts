/**
 * File mutation layer — applies file mutations with backup and rollback.
 * All filesystem writes go through here for safety.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { FileMutation } from './types';

interface BackupManifest {
  id: string;
  createdAt: string;
  projectPath: string;
  mutations: Array<{
    type: FileMutation['type'];
    filePath: string;
    /** True if the file existed before mutation (backup copy stored). */
    hadExistingFile: boolean;
    /** True if file was newly created (remove on rollback). */
    createdNew: boolean;
  }>;
}

const BACKUP_ROOT = path.join(os.tmpdir(), 'arcforge-backups');

/** Diff record for a single file: original (before) and modified (after) content. */
export interface FileDiffRecord {
  filePath: string;
  original: string;
  modified: string;
  isNew: boolean;
}

export class FileMutationLayer {
  /**
   * Apply a set of file mutations with pre-mutation backup.
   * Returns the backup ID for potential rollback.
   */
  /** Order for mutation types so that create runs before append/insert for the same file. */
  private static mutationTypeOrder(m: FileMutation): number {
    if (m.type === 'create') return 0;
    if (m.type === 'insert') return 1;
    if (m.type === 'append') return 2;
    return 3;
  }

  apply(projectPath: string, mutations: FileMutation[]): string {
    const sorted = [...mutations].sort((a, b) => {
      const orderA = FileMutationLayer.mutationTypeOrder(a);
      const orderB = FileMutationLayer.mutationTypeOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      return (a.filePath ?? '').localeCompare(b.filePath ?? '');
    });

    const backupId = `forge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const backupDir = path.join(BACKUP_ROOT, backupId);
    fs.mkdirSync(backupDir, { recursive: true });

    const manifest: BackupManifest = {
      id: backupId,
      createdAt: new Date().toISOString(),
      projectPath,
      mutations: [],
    };

    for (const m of sorted) {
      const absPath = path.resolve(projectPath, m.filePath);
      const existed = fs.existsSync(absPath);

      // Backup existing file (only once per file — keep original before any mutations)
      if (existed) {
        const backupFile = path.join(backupDir, m.filePath.replace(/\//g, '__'));
        if (!fs.existsSync(backupFile)) {
          fs.copyFileSync(absPath, backupFile);
        }
      }

      manifest.mutations.push({
        type: m.type,
        filePath: m.filePath,
        hadExistingFile: existed,
        createdNew: m.type === 'create' && !existed,
      });

      this.applyMutation(projectPath, m);
    }

    // Save manifest
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return backupId;
  }

  /** Rollback all mutations from a backup. */
  rollback(backupId: string): void {
    const backupDir = path.join(BACKUP_ROOT, backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // Restore in reverse order
    for (const entry of [...manifest.mutations].reverse()) {
      const absPath = path.resolve(manifest.projectPath, entry.filePath);

      if (entry.createdNew) {
        // Remove newly created file
        if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        // Remove empty parent directories up to project root
        this.cleanEmptyDirs(path.dirname(absPath), manifest.projectPath);
      } else if (entry.hadExistingFile) {
        // Restore from backup
        const backupFile = path.join(backupDir, entry.filePath.replace(/\//g, '__'));
        if (fs.existsSync(backupFile)) {
          fs.copyFileSync(backupFile, absPath);
        }
      }
    }

    // Clean up backup directory
    fs.rmSync(backupDir, { recursive: true, force: true });
  }

  /**
   * Get before/after diffs for all files affected by a backup.
   * Must be called AFTER apply() because it reads the post-mutation files from disk.
   */
  getDiffs(backupId: string, projectPath: string): FileDiffRecord[] {
    const backupDir = path.join(BACKUP_ROOT, backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return [];

    const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const diffs: FileDiffRecord[] = [];

    for (const entry of manifest.mutations) {
      const absPath = path.resolve(projectPath, entry.filePath);
      let original = '';
      let modified = '';

      if (entry.hadExistingFile) {
        const backupFile = path.join(backupDir, entry.filePath.replace(/\//g, '__'));
        if (fs.existsSync(backupFile)) {
          original = fs.readFileSync(backupFile, 'utf-8');
        }
      }

      if (fs.existsSync(absPath)) {
        modified = fs.readFileSync(absPath, 'utf-8');
      }

      diffs.push({
        filePath: entry.filePath,
        original,
        modified,
        isNew: entry.createdNew,
      });
    }

    return diffs;
  }

  /** Discard backup without rollback (user confirmed "Keep"). */
  discardBackup(backupId: string): void {
    const backupDir = path.join(BACKUP_ROOT, backupId);
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  }

  /**
   * Confirm a single file from a pending backup (keep its modified content).
   * Removes the file from the manifest so it won't be restored on rollback.
   */
  confirmPendingFile(backupId: string, filePath: string): void {
    const backupDir = path.join(BACKUP_ROOT, backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;

    const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifest.mutations = manifest.mutations.filter((m) => m.filePath !== filePath);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const backupFile = path.join(backupDir, filePath.replace(/\//g, '__'));
    if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
  }

  /**
   * Rollback a single file from a backup (restore original content).
   */
  rollbackFile(backupId: string, filePath: string, projectPath: string): void {
    const backupDir = path.join(BACKUP_ROOT, backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) throw new Error(`Backup not found: ${backupId}`);

    const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const entry = manifest.mutations.find((m) => m.filePath === filePath);
    if (!entry) throw new Error(`File ${filePath} not in backup`);

    const absPath = path.resolve(projectPath, filePath);

    if (entry.createdNew) {
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      this.cleanEmptyDirs(path.dirname(absPath), projectPath);
    } else if (entry.hadExistingFile) {
      const backupFile = path.join(backupDir, filePath.replace(/\//g, '__'));
      if (fs.existsSync(backupFile)) {
        fs.copyFileSync(backupFile, absPath);
      }
    }
  }

  /** Check if a file exists relative to project root. */
  fileExists(projectPath: string, relativePath: string): boolean {
    return fs.existsSync(path.resolve(projectPath, relativePath));
  }

  /** Read a file relative to project root. Returns null if not found. */
  readFile(projectPath: string, relativePath: string): string | null {
    const absPath = path.resolve(projectPath, relativePath);
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf-8');
  }

  private applyMutation(projectPath: string, mutation: FileMutation): void {
    const absPath = path.resolve(projectPath, mutation.filePath);

    switch (mutation.type) {
      case 'create': {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        if (fs.existsSync(absPath)) {
          throw new Error(`Cannot create — file already exists: ${mutation.filePath}`);
        }
        fs.writeFileSync(absPath, mutation.content, 'utf-8');
        break;
      }
      case 'append': {
        if (!fs.existsSync(absPath)) {
          throw new Error(`Cannot append — file does not exist: ${mutation.filePath}`);
        }
        fs.appendFileSync(absPath, mutation.content, 'utf-8');
        break;
      }
      case 'insert': {
        if (!fs.existsSync(absPath)) {
          throw new Error(`Cannot insert — file does not exist: ${mutation.filePath}`);
        }
        const existing = fs.readFileSync(absPath, 'utf-8');
        if (!mutation.marker) {
          throw new Error(`Insert mutation requires a marker: ${mutation.filePath}`);
        }
        const idx = existing.lastIndexOf(mutation.marker);
        if (idx === -1) {
          throw new Error(
            `Marker "${mutation.marker}" not found in ${mutation.filePath}`
          );
        }
        const before = existing.slice(0, idx);
        const after = existing.slice(idx);
        fs.writeFileSync(absPath, before + mutation.content + after, 'utf-8');
        break;
      }
      case 'replace': {
        if (!fs.existsSync(absPath)) {
          throw new Error(`Cannot replace — file does not exist: ${mutation.filePath}`);
        }
        const existing = fs.readFileSync(absPath, 'utf-8');
        if (!mutation.pattern) {
          throw new Error(`Replace mutation requires a pattern: ${mutation.filePath}`);
        }
        const replaced = existing.replace(new RegExp(mutation.pattern), mutation.content);
        if (replaced === existing) {
          throw new Error(
            `Pattern "${mutation.pattern}" did not match in ${mutation.filePath}`
          );
        }
        fs.writeFileSync(absPath, replaced, 'utf-8');
        break;
      }
    }
  }

  private cleanEmptyDirs(dir: string, stopAt: string): void {
    const resolved = path.resolve(dir);
    const stop = path.resolve(stopAt);
    if (!resolved.startsWith(stop) || resolved === stop) return;
    try {
      const entries = fs.readdirSync(resolved);
      if (entries.length === 0) {
        fs.rmdirSync(resolved);
        this.cleanEmptyDirs(path.dirname(resolved), stopAt);
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}
