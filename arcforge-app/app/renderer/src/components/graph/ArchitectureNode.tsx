/**
 * Architecture design nodes — MVC, DDD, Microservices, etc.
 * Editable labels; used by the architecture adapter.
 * Shows + button on hover (like Laravel) to add child nodes via Forge.
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { useForgeStore } from '../../store/forgeStore';
import { NODE_COLORS } from './BaseNode';

const ARCH_ICONS: Record<string, string> = {
  arch_entry: '🚀',
  arch_entry_interface: '⇥',
  arch_domain: '◉',
  arch_aggregate: '⊞',
  arch_bounded_context: '▤',
  arch_application_service: '◈',
  arch_domain_event: '⚡',
  arch_entity: '◉',
  arch_value_object: '◧',
  arch_service: '⬡',
  arch_use_case: '◈',
  arch_interface: '◻',
  arch_repository: '⊞',
  arch_repository_interface: '◻',
  arch_module: '▤',
  arch_layer: '⊟',
  arch_model: '⊟',
  arch_view: '⊠',
  arch_controller: '⌘',
  arch_microservice: '⬡',
  arch_event: '⚡',
  arch_handler: '◁',
  arch_listener: '◁',
  arch_job: '↻',
  arch_middleware: '⇥',
  arch_router: '⇢',
  arch_form_request: '✦',
  arch_resource: '⊠',
  arch_response: '↩',
  arch_database: '▣',
  arch_eloquent: '⊟',
  arch_orm: '▣',
  arch_migration: '⊛',
  arch_seeder: '◎',
  arch_factory: '⚙',
  arch_di_container: '⊕',
  arch_component: '▣',
};

const ARCH_TYPE_LABELS: Record<string, string> = {
  arch_entry: 'Entry',
  arch_entry_interface: 'Entry Interface',
  arch_domain: 'Domain',
  arch_aggregate: 'Aggregate',
  arch_bounded_context: 'Bounded Context',
  arch_application_service: 'App Service',
  arch_domain_event: 'Domain Event',
  arch_entity: 'Entity',
  arch_value_object: 'Value Object',
  arch_service: 'Service',
  arch_use_case: 'Use Case',
  arch_interface: 'Interface',
  arch_repository: 'Repository',
  arch_repository_interface: 'Repo Interface',
  arch_module: 'Module',
  arch_layer: 'Layer',
  arch_model: 'Model',
  arch_view: 'View',
  arch_controller: 'Controller',
  arch_microservice: 'Microservice',
  arch_event: 'Event',
  arch_handler: 'Handler',
  arch_listener: 'Listener',
  arch_job: 'Job',
  arch_middleware: 'Middleware',
  arch_router: 'Router',
  arch_form_request: 'Form Request',
  arch_resource: 'Resource',
  arch_response: 'Response',
  arch_database: 'Database',
  arch_eloquent: 'Eloquent',
  arch_orm: 'ORM',
  arch_migration: 'Migration',
  arch_seeder: 'Seeder',
  arch_factory: 'Factory',
  arch_di_container: 'DI Container',
  arch_component: 'Component',
};

const ARCH_DESCRIPTIONS: Record<string, string> = {
  arch_entry: 'Top-level entrypoint of the application.',
  arch_entry_interface: 'Presentation layer — HTTP, CLI, gRPC.',
  arch_domain: 'Core business domain containing entities and rules.',
  arch_aggregate: 'Cluster of domain objects treated as a single unit.',
  arch_bounded_context: 'Isolated domain model with its own ubiquitous language.',
  arch_application_service: 'Single business scenario. Orchestrates domain objects.',
  arch_domain_event: 'Something happened. Triggers listeners and side effects.',
  arch_entity: 'Domain object with unique identity. Contains business rules.',
  arch_value_object: 'Immutable, no identity. Defined purely by its value.',
  arch_service: 'Reusable business logic. Called from multiple use cases.',
  arch_use_case: 'Single business scenario. Orchestrates entities, repos, events.',
  arch_interface: 'Contract. Business depends on this, never on implementation.',
  arch_repository: 'Implements interface. Handles all DB interaction for entity.',
  arch_repository_interface: 'Contract for data access. Implemented by infrastructure.',
  arch_module: 'Cohesive group of related classes and concerns.',
  arch_layer: 'Horizontal separation of concerns (Domain, App, Infra).',
  arch_model: 'ORM model. Maps database table. Used only in repository.',
  arch_view: 'Presentation template rendered to the user.',
  arch_controller: 'Accepts HTTP request, delegates to service. No business logic.',
  arch_microservice: 'Independent deployable service with its own data store.',
  arch_event: 'Something happened. Triggers listeners and side effects.',
  arch_handler: 'Processes a specific command or message.',
  arch_listener: 'Reacts to an event. May dispatch jobs or call services.',
  arch_job: 'Background task dispatched to queue. Runs async.',
  arch_middleware: 'Intercepts before controller. Auth, throttle, CORS, logging.',
  arch_router: 'Maps incoming requests to their handlers.',
  arch_form_request: 'Validates and transforms input before business logic.',
  arch_resource: 'Formats data to JSON for the response (serialiser/transformer).',
  arch_response: 'Structured output returned to the caller.',
  arch_database: 'Physical storage. Postgres, MySQL, MongoDB, SQLite.',
  arch_eloquent: 'Laravel Eloquent ORM model and its ActiveRecord methods.',
  arch_orm: 'Object-Relational Mapping — bridges objects and database tables.',
  arch_migration: 'Versioned database schema change.',
  arch_seeder: 'Populates database with seed data for testing or defaults.',
  arch_factory: 'Generates fake model instances for tests or seeders.',
  arch_di_container: 'Dependency Injection Container — resolves and wires dependencies.',
  arch_component: 'Generic reusable component.',
};

export interface ArchitectureNodeData {
  label: string;
  nodeType: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

const ArchitectureNodeInner: React.FC<NodeProps<ArchitectureNodeData>> = ({ data, id: nodeId, selected }) => {
  const nodeType = (data?.nodeType ?? 'arch_component') as keyof typeof NODE_COLORS;
  const colors = NODE_COLORS[nodeType] ?? NODE_COLORS.arch_component;
  const label = data?.label ?? 'Node';
  const icon = ARCH_ICONS[nodeType] ?? '▣';
  const typeLabel = ARCH_TYPE_LABELS[nodeType] ?? 'Component';
  const description = ARCH_DESCRIPTIONS[nodeType];
  const openForge = useForgeStore((s) => s.openForge);

  const handleForgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!nodeId) return;
      openForge({
        id: nodeId,
        type: nodeType,
        label,
        filePath: data?.filePath ?? '',
        metadata: data?.metadata ?? {},
      });
    },
    [openForge, nodeId, nodeType, label, data?.filePath, data?.metadata]
  );

  return (
    <>
      <div className="arcforge-node arcforge-architecture-node">
        <div className="arcforge-node-bar" style={{ background: colors.bg }} />
        <button
          className="arcforge-forge-btn"
          onClick={handleForgeClick}
          title="Add node"
        >
          +
        </button>
        <div className="arcforge-node-header">
          <div
            className="arcforge-node-icon"
            style={{
              background: `${colors.bg}1a`,
              borderColor: `${colors.bg}2e`,
            }}
          >
            {icon}
          </div>
          <span className="arcforge-node-type" style={{ color: colors.bg }}>
            {typeLabel}
          </span>
        </div>
        <div className="arcforge-node-label">{label}</div>
        {description && (
          <div className="arcforge-node-desc">
            {selected && nodeType === 'arch_orm' ? 'Object-Relational Mapping' : description}
          </div>
        )}
        <div className="arcforge-node-handles">
          <div className="arcforge-node-handle-group">
            <span className="arcforge-node-handle-label">in</span>
          </div>
          <div className="arcforge-node-handle-group">
            <span className="arcforge-node-handle-label">out</span>
          </div>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="arcforge-handle arcforge-handle-bottom" />
      <Handle type="source" position={Position.Right} className="arcforge-handle arcforge-handle-bottom" />
    </>
  );
};

export const ArchitectureNode = memo(ArchitectureNodeInner);
