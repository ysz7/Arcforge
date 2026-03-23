/**
 * Blueprint registry — stores and queries available blueprints.
 * Framework adapters register their blueprints here.
 */

import type { Blueprint, BlueprintInfo } from './types';

export class BlueprintRegistry {
  private readonly blueprints = new Map<string, Blueprint>();

  register(blueprint: Blueprint): void {
    if (this.blueprints.has(blueprint.name)) {
      throw new Error(`Blueprint "${blueprint.name}" is already registered`);
    }
    this.blueprints.set(blueprint.name, blueprint);
  }

  unregister(name: string): void {
    this.blueprints.delete(name);
  }

  get(name: string): Blueprint | undefined {
    return this.blueprints.get(name);
  }

  /** Return blueprints that support a given node type. */
  getForNodeType(nodeType: string): Blueprint[] {
    return Array.from(this.blueprints.values()).filter((b) =>
      b.supportedNodeTypes.includes(nodeType)
    );
  }

  /** Serializable info (no function references) for IPC. */
  getInfoForNodeType(nodeType: string): BlueprintInfo[] {
    return this.getForNodeType(nodeType).map((b) => ({
      name: b.name,
      displayName: b.displayName,
      description: b.description,
      category: b.category,
      supportedNodeTypes: b.supportedNodeTypes,
      params: b.params,
    }));
  }

  getAll(): Blueprint[] {
    return Array.from(this.blueprints.values());
  }

  clear(): void {
    this.blueprints.clear();
  }
}
