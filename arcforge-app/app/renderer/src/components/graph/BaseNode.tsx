/**
 * Base styles for Blueprint-like nodes. Shared layout and CSS variables.
 * Includes the Forge "+" button shown on hover (opens Forge modal).
 */

import React, { useCallback, memo } from 'react';
import { useForgeStore } from '../../store/forgeStore';
import { useGraphStore } from '../../store/graphStore';

export const NODE_COLORS = {
  arch_entry: { bg: '#64748b', border: '#64748b', text: '#f0f0f2' },
  arch_entry_interface: { bg: '#6366f1', border: '#6366f1', text: '#f0f0f2' },
  arch_domain: { bg: '#f472b6', border: '#f472b6', text: '#f0f0f2' },
  arch_aggregate: { bg: '#a78bfa', border: '#a78bfa', text: '#f0f0f2' },
  arch_bounded_context: { bg: '#c084fc', border: '#c084fc', text: '#f0f0f2' },
  arch_application_service: { bg: '#4a9eff', border: '#4a9eff', text: '#f0f0f2' },
  arch_domain_event: { bg: '#facc15', border: '#facc15', text: '#f0f0f2' },
  arch_entity: { bg: '#f472b6', border: '#f472b6', text: '#f0f0f2' },
  arch_value_object: { bg: '#86efac', border: '#86efac', text: '#f0f0f2' },
  arch_service: { bg: '#34d399', border: '#34d399', text: '#f0f0f2' },
  arch_use_case: { bg: '#a78bfa', border: '#a78bfa', text: '#f0f0f2' },
  arch_interface: { bg: '#c084fc', border: '#c084fc', text: '#f0f0f2' },
  arch_repository: { bg: '#fb923c', border: '#fb923c', text: '#f0f0f2' },
  arch_repository_interface: { bg: '#9ca3af', border: '#9ca3af', text: '#f0f0f2' },
  arch_module: { bg: '#14b8a6', border: '#14b8a6', text: '#f0f0f2' },
  arch_layer: { bg: '#34d399', border: '#34d399', text: '#f0f0f2' },
  arch_model: { bg: '#f472b6', border: '#f472b6', text: '#f0f0f2' },
  arch_view: { bg: '#4a9eff', border: '#4a9eff', text: '#f0f0f2' },
  arch_controller: { bg: '#4a9eff', border: '#4a9eff', text: '#f0f0f2' },
  arch_microservice: { bg: '#34d399', border: '#34d399', text: '#f0f0f2' },
  arch_event: { bg: '#f97316', border: '#f97316', text: '#f0f0f2' },
  arch_handler: { bg: '#fb923c', border: '#fb923c', text: '#f0f0f2' },
  arch_listener: { bg: '#fb923c', border: '#fb923c', text: '#f0f0f2' },
  arch_job: { bg: '#facc15', border: '#facc15', text: '#f0f0f2' },
  arch_middleware: { bg: '#94a3b8', border: '#94a3b8', text: '#f0f0f2' },
  arch_router: { bg: '#38bdf8', border: '#38bdf8', text: '#f0f0f2' },
  arch_form_request: { bg: '#a78bfa', border: '#a78bfa', text: '#f0f0f2' },
  arch_resource: { bg: '#c084fc', border: '#c084fc', text: '#f0f0f2' },
  arch_response: { bg: '#4a9eff', border: '#4a9eff', text: '#f0f0f2' },
  arch_database: { bg: '#22d3ee', border: '#22d3ee', text: '#f0f0f2' },
  arch_eloquent: { bg: '#a78bfa', border: '#a78bfa', text: '#f0f0f2' },
  arch_orm: { bg: '#22d3ee', border: '#22d3ee', text: '#f0f0f2' },
  arch_migration: { bg: '#34d399', border: '#34d399', text: '#f0f0f2' },
  arch_seeder: { bg: '#22d3ee', border: '#22d3ee', text: '#f0f0f2' },
  arch_factory: { bg: '#facc15', border: '#facc15', text: '#f0f0f2' },
  arch_di_container: { bg: '#4a9eff', border: '#4a9eff', text: '#f0f0f2' },
  arch_component: { bg: '#6b7280', border: '#6b7280', text: '#f0f0f2' },
  arch_blank: { bg: '#4b5563', border: '#4b5563', text: '#f0f0f2' },
} as const;

const NODE_ICONS: Record<string, string> = {
  arch_entry: '🚀',
  arch_entry_interface: '◻',
  arch_domain: '◉',
  arch_aggregate: '⊞',
  arch_bounded_context: '▤',
  arch_application_service: '◈',
  arch_domain_event: '⚡',
  arch_entity: '◉',
  arch_value_object: '◎',
  arch_service: '⬡',
  arch_use_case: '◈',
  arch_interface: '◻',
  arch_repository: '⊞',
  arch_repository_interface: '◻',
  arch_module: '▣',
  arch_layer: '▤',
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
  arch_orm: '⊞',
  arch_migration: '⊛',
  arch_seeder: '◎',
  arch_factory: '⊕',
  arch_di_container: '⬖',
  arch_component: '▣',
  arch_blank: '○',
};

const TYPE_LABELS: Record<string, string> = {
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
  arch_blank: 'Blank',
};

const NODE_DESCRIPTIONS: Record<string, string> = {
  arch_entry: 'Application entry point.',
  arch_entry_interface: 'Public-facing contract of the application entry.',
  arch_domain: 'Business domain grouping related concepts.',
  arch_aggregate: 'Cluster of domain objects treated as a unit.',
  arch_bounded_context: 'Explicit boundary within which a model applies.',
  arch_application_service: 'Single business scenario. Orchestrates entities, repos, events.',
  arch_domain_event: 'Something significant that happened in the domain.',
  arch_entity: 'Domain object with unique identity. Contains business rules.',
  arch_value_object: 'Immutable value with no identity, defined by its attributes.',
  arch_service: 'Reusable business logic. Called from multiple use cases.',
  arch_use_case: 'Single application operation from the user perspective.',
  arch_interface: 'Contract. Business depends on this, never on implementation.',
  arch_repository: 'Implements interface. Handles all DB interaction for entity.',
  arch_repository_interface: 'Abstract contract for data access operations.',
  arch_module: 'Cohesive group of related components.',
  arch_layer: 'Horizontal slice of the architecture (e.g. domain, infra).',
  arch_model: 'ORM model. Maps database table.',
  arch_view: 'UI or template rendered for a response.',
  arch_controller: 'Accepts HTTP request, delegates to service. No business logic.',
  arch_microservice: 'Independently deployable service with a bounded scope.',
  arch_event: 'Something happened. Triggers listeners and side effects.',
  arch_handler: 'Processes a command or event.',
  arch_listener: 'Reacts to an event. May dispatch jobs or call services.',
  arch_job: 'Background task dispatched to queue. Runs async.',
  arch_middleware: 'Intercepts before controller. Auth, throttle, CORS, logging.',
  arch_router: 'Routes incoming requests to handlers.',
  arch_form_request: 'Validates and transforms input before business logic.',
  arch_resource: 'Formats data to JSON for the response (serialiser/transformer).',
  arch_response: 'Structured response returned to the caller.',
  arch_database: 'Physical storage. Postgres, MySQL, MongoDB, SQLite.',
  arch_eloquent: 'Eloquent ORM model.',
  arch_orm: 'Object-relational mapping layer.',
  arch_migration: 'Versioned database schema change.',
  arch_seeder: 'Populates database with seed data for testing or defaults.',
  arch_factory: 'Creates instances of entities or models for testing.',
  arch_di_container: 'Dependency injection container wiring.',
  arch_component: 'Generic reusable architectural component.',
  arch_blank: 'Custom node. Edit label and description freely.',
};

/** Node types that support Forge actions. */
const FORGE_SUPPORTED_TYPES = new Set([
  'arch_entity',
  'arch_application_service',
  'arch_controller',
  'arch_service',
  'arch_repository',
  'arch_model',
  'arch_use_case',
  'arch_event',
  'arch_listener',
  'arch_job',
  'arch_middleware',
  'arch_resource',
  'arch_component',
]);

export type NodeType =
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

export interface BaseNodeProps {
  label: string;
  nodeType: NodeType;
  filePath?: string;
  children?: React.ReactNode;
  icon?: string;
  /** Instance-specific annotation shown instead of the default type description. */
  subtitle?: string;
  /** React Flow node id (needed for forge). */
  nodeId?: string;
  metadata?: Record<string, unknown>;
}

const BaseNodeInner: React.FC<BaseNodeProps> = ({
  label,
  nodeType,
  icon,
  subtitle,
  children,
  nodeId,
  filePath,
  metadata,
}) => {
  const activePluginInfo = useGraphStore((s) => s.activePluginInfo);

  // Dynamic lookup from active plugin's nodeTypes, fallback to static maps
  const pluginNodeDef = activePluginInfo?.nodeTypes.find(n => n.id === nodeType);
  const staticColors = NODE_COLORS[nodeType as keyof typeof NODE_COLORS];
  const colors = staticColors ?? (pluginNodeDef ? { bg: pluginNodeDef.color, border: pluginNodeDef.color, text: '#f0f0f2' } : { bg: '#6b7280', border: '#6b7280', text: '#f0f0f2' });

  const openForge = useForgeStore((s) => s.openForge);
  const showForge = FORGE_SUPPORTED_TYPES.has(nodeType);
  const resolvedIcon = icon ?? NODE_ICONS[nodeType] ?? pluginNodeDef?.icon ?? '▣';
  const description = subtitle ?? NODE_DESCRIPTIONS[nodeType] ?? pluginNodeDef?.description;

  const handlePlusClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!nodeId) return;
      openForge({
        id: nodeId,
        type: nodeType,
        label,
        filePath: filePath ?? '',
        metadata,
      });
    },
    [openForge, nodeId, nodeType, label, filePath, metadata]
  );

  return (
    <div
      className="arcforge-node"
      style={{ maxWidth: undefined }}
    >
      <div className="arcforge-node-bar" style={{ background: colors.bg }} />
      {showForge && (
        <button
          className="arcforge-forge-btn"
          onClick={handlePlusClick}
          title="Forge"
        >
          +
        </button>
      )}
      <div className="arcforge-node-header">
        <div
          className="arcforge-node-icon"
          style={{
            background: `${colors.bg}1a`,
            borderColor: `${colors.bg}2e`,
          }}
        >
          {resolvedIcon}
        </div>
        <span className="arcforge-node-type" style={{ color: colors.bg }}>
          {TYPE_LABELS[nodeType] ?? pluginNodeDef?.label ?? nodeType}
        </span>
      </div>
      <div className="arcforge-node-label">{label}</div>
      {description && (
        <div className="arcforge-node-desc">{description}</div>
      )}
      {children && <div className="arcforge-node-body">{children}</div>}
      <div className="arcforge-node-handles">
        <div className="arcforge-node-handle-group">
          <span className="arcforge-node-handle-label">in</span>
        </div>
        <div className="arcforge-node-handle-group">
          <span className="arcforge-node-handle-label">out</span>
        </div>
      </div>
    </div>
  );
};

export const BaseNode = memo(BaseNodeInner);
