/**
 * Persists graph layout (node positions, viewport) to a per-project .arcforge-<name> file.
 */

import type { GraphNodePositions, GraphViewport } from '../store/graphStore';

export interface ArcforgeConfig {
  graphNodePositions?: GraphNodePositions;
  graphViewport?: GraphViewport;
}

declare const window: Window & { arcforge?: import('../../../shared/types').ArcforgeAPI };

/**
 * Derives the config filename for a project.
 * - File-based (e.g. ArcSpec): uses the entry filename without extension → `.arcforge-my-architecture`
 * - Folder-based (e.g. Laravel): uses the project folder name → `.arcforge-laravel-project`
 */
export function getConfigFileName(projectPath: string, entryFileRelative?: string | null): string {
  let name: string;

  if (entryFileRelative && entryFileRelative.trim()) {
    const parts = entryFileRelative.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1];
    name = filename.replace(/\.[^.]+$/, '');
  } else {
    const normalized = projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = normalized.split('/');
    name = parts[parts.length - 1];
  }

  const safe = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `.arcforge-${safe || 'project'}`;
}

export async function loadArcforgeConfig(
  projectPath: string,
  _adapterId?: string | null,
  entryFileRelative?: string | null
): Promise<ArcforgeConfig | null> {
  const api = window.arcforge?.fs;
  if (!api) return null;

  const fileName = getConfigFileName(projectPath, entryFileRelative);
  const res = await api.readFile(projectPath, fileName);
  if (!res.ok || res.content == null || res.content.trim() === '') return null;
  try {
    return JSON.parse(res.content) as ArcforgeConfig;
  } catch {
    return null;
  }
}

export async function saveArcforgeConfig(
  projectPath: string,
  config: ArcforgeConfig,
  _adapterId?: string | null,
  entryFileRelative?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const api = window.arcforge?.fs;
  if (!api) return { ok: false, error: 'API not available' };

  const fileName = getConfigFileName(projectPath, entryFileRelative);
  const content = JSON.stringify(config, null, 2);
  return api.writeFile(projectPath, fileName, content);
}
