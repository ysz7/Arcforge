/**
 * Resolves which framework adapter applies to a project path.
 * Uses registered adapters; no framework-specific logic here.
 */

import type { FrameworkAdapter } from '../ports';

export class ProjectDetector {
  constructor(private readonly adapters: FrameworkAdapter[]) {}

  async detect(projectPath: string): Promise<FrameworkAdapter | null> {
    for (const adapter of this.adapters) {
      const matched = await adapter.detect(projectPath);
      if (matched) return adapter;
    }
    return null;
  }
}
