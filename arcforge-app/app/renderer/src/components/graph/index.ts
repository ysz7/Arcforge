/**
 * Blueprint-style custom nodes for the architecture graph.
 */

import type { NodeTypes, NodeProps } from 'reactflow';
import { ArchitectureNode, type ArchitectureNodeData } from './ArchitectureNode';
import { PluginNode } from './PluginNode';

export { PluginNode };

/** Static node types for built-in arcspec nodes. */
export const nodeTypes: NodeTypes = {
  arch_entry: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_entry_interface: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_domain: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_aggregate: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_bounded_context: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_application_service: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_domain_event: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_entity: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_value_object: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_service: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_use_case: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_interface: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_repository: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_repository_interface: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_module: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_layer: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_model: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_view: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_controller: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_microservice: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_event: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_handler: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_listener: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_job: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_middleware: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_router: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_form_request: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_resource: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_response: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_database: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_eloquent: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_orm: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_migration: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_seeder: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_factory: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_di_container: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
  arch_component: ArchitectureNode as React.ComponentType<NodeProps<ArchitectureNodeData>>,
};

export { NODE_COLORS } from './BaseNode';
