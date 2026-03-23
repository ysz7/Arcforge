/**
 * Graph domain types — single source of truth for core and renderer.
 */

export type GraphNodeType =
  // ArcSpec architecture nodes (arch_* prefix)
  | 'arch_entry'
  | 'arch_entry_interface'
  | 'arch_domain'
  | 'arch_aggregate'
  | 'arch_bounded_context'
  | 'arch_application_service'
  | 'arch_domain_event'
  | 'arch_entity'
  | 'arch_value_object'
  | 'arch_service'
  | 'arch_use_case'
  | 'arch_interface'
  | 'arch_repository'
  | 'arch_repository_interface'
  | 'arch_module'
  | 'arch_layer'
  | 'arch_model'
  | 'arch_view'
  | 'arch_controller'
  | 'arch_microservice'
  | 'arch_event'
  | 'arch_handler'
  | 'arch_listener'
  | 'arch_job'
  | 'arch_middleware'
  | 'arch_router'
  | 'arch_form_request'
  | 'arch_resource'
  | 'arch_response'
  | 'arch_database'
  | 'arch_eloquent'
  | 'arch_orm'
  | 'arch_migration'
  | 'arch_seeder'
  | 'arch_factory'
  | 'arch_di_container'
  | 'arch_component'
  | 'arch_blank';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  filePath: string;
  label: string;
  metadata: Record<string, unknown>;
}

export type GraphEdgeType =
  | 'arch_dependency'
  | 'arch_contains'
  | 'arch_implements';

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: GraphEdgeType;
  sourceHandle?: string;
  targetHandle?: string;
  metadata?: Record<string, unknown>;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSnapshot {
  version: number;
  createdAt: string;
  projectPath: string;
  graph: Graph;
}

export interface AnalysisIssue {
  filePath?: string;
  line?: number;
  message: string;
}

export interface AnalysisResult {
  graph: Graph;
  errors?: AnalysisIssue[];
  warnings?: AnalysisIssue[];
}
