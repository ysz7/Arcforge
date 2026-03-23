/**
 * In-memory graph store.
 * Holds the current graph state; can be serialized to JSON for snapshots.
 */

import type { Graph, GraphNode, GraphEdge, GraphSnapshot, AnalysisIssue } from './types.js';

export class GraphStore {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private projectPath: string = '';
  private version: number = 0;
  private analysisIssues: AnalysisIssue[] = [];

  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  getProjectPath(): string {
    return this.projectPath;
  }

  setGraph(graph: Graph): void {
    this.nodes.clear();
    this.edges.clear();
    graph.nodes.forEach((n) => this.nodes.set(n.id, n));
    graph.edges.forEach((e) => this.edges.set(e.id, e));
    this.version += 1;
  }

  getGraph(): Graph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  setAnalysisIssues(issues: AnalysisIssue[]): void {
    this.analysisIssues = issues;
  }

  getAnalysisIssues(): AnalysisIssue[] {
    return [...this.analysisIssues];
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): GraphEdge | undefined {
    return this.edges.get(id);
  }

  getVersion(): number {
    return this.version;
  }

  toSnapshot(): GraphSnapshot {
    return {
      version: this.version,
      createdAt: new Date().toISOString(),
      projectPath: this.projectPath,
      graph: this.getGraph(),
    };
  }

  loadSnapshot(snapshot: GraphSnapshot): void {
    this.version = snapshot.version;
    this.projectPath = snapshot.projectPath;
    this.setGraph(snapshot.graph);
  }
}
