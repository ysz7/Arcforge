/**
 * ArcSpec plugin node type definitions.
 * Used by both the main process (plugin metadata) and renderer (display).
 */

import type { PluginNodeTypeDef } from '../../shared/types/plugin';

export const ARCSPEC_NODE_TYPES: PluginNodeTypeDef[] = [
  { id: 'arch_entry', label: 'Entry', description: 'Application entry point.', color: '#64748b', icon: '🚀', deletable: true, renameable: true, openable: false },
  { id: 'arch_entry_interface', label: 'Entry Interface', description: 'Public-facing contract of the application entry.', color: '#6366f1', icon: '◻', deletable: true, renameable: true, openable: false },
  { id: 'arch_domain', label: 'Domain', description: 'Business domain grouping related concepts.', color: '#f472b6', icon: '◉', deletable: true, renameable: true, openable: false },
  { id: 'arch_aggregate', label: 'Aggregate', description: 'Cluster of domain objects treated as a unit.', color: '#a78bfa', icon: '⊞', deletable: true, renameable: true, openable: false },
  { id: 'arch_bounded_context', label: 'Bounded Context', description: 'Explicit boundary within which a model applies.', color: '#c084fc', icon: '▤', deletable: true, renameable: true, openable: false },
  { id: 'arch_application_service', label: 'App Service', description: 'Single business scenario. Orchestrates entities, repos, events.', color: '#4a9eff', icon: '◈', deletable: true, renameable: true, openable: false },
  { id: 'arch_domain_event', label: 'Domain Event', description: 'Something significant that happened in the domain.', color: '#facc15', icon: '⚡', deletable: true, renameable: true, openable: false },
  { id: 'arch_entity', label: 'Entity', description: 'Domain object with unique identity. Contains business rules.', color: '#f472b6', icon: '◉', deletable: true, renameable: true, openable: false },
  { id: 'arch_value_object', label: 'Value Object', description: 'Immutable value with no identity, defined by its attributes.', color: '#86efac', icon: '◎', deletable: true, renameable: true, openable: false },
  { id: 'arch_service', label: 'Service', description: 'Reusable business logic. Called from multiple use cases.', color: '#34d399', icon: '⬡', deletable: true, renameable: true, openable: false },
  { id: 'arch_use_case', label: 'Use Case', description: 'Single application operation from the user perspective.', color: '#a78bfa', icon: '◈', deletable: true, renameable: true, openable: false },
  { id: 'arch_interface', label: 'Interface', description: 'Contract. Business depends on this, never on implementation.', color: '#c084fc', icon: '◻', deletable: true, renameable: true, openable: false },
  { id: 'arch_repository', label: 'Repository', description: 'Implements interface. Handles all DB interaction for entity.', color: '#fb923c', icon: '⊞', deletable: true, renameable: true, openable: false },
  { id: 'arch_repository_interface', label: 'Repo Interface', description: 'Abstract contract for data access operations.', color: '#9ca3af', icon: '◻', deletable: true, renameable: true, openable: false },
  { id: 'arch_module', label: 'Module', description: 'Cohesive group of related components.', color: '#14b8a6', icon: '▣', deletable: true, renameable: true, openable: false },
  { id: 'arch_layer', label: 'Layer', description: 'Horizontal slice of the architecture (e.g. domain, infra).', color: '#34d399', icon: '▤', deletable: true, renameable: true, openable: false },
  { id: 'arch_model', label: 'Model', description: 'ORM model. Maps database table.', color: '#f472b6', icon: '⊟', deletable: true, renameable: true, openable: false },
  { id: 'arch_view', label: 'View', description: 'UI or template rendered for a response.', color: '#4a9eff', icon: '⊠', deletable: true, renameable: true, openable: false },
  { id: 'arch_controller', label: 'Controller', description: 'Accepts HTTP request, delegates to service. No business logic.', color: '#4a9eff', icon: '⌘', deletable: true, renameable: true, openable: false },
  { id: 'arch_microservice', label: 'Microservice', description: 'Independently deployable service with a bounded scope.', color: '#34d399', icon: '⬡', deletable: true, renameable: true, openable: false },
  { id: 'arch_event', label: 'Event', description: 'Something happened. Triggers listeners and side effects.', color: '#f97316', icon: '⚡', deletable: true, renameable: true, openable: false },
  { id: 'arch_handler', label: 'Handler', description: 'Processes a command or event.', color: '#fb923c', icon: '◁', deletable: true, renameable: true, openable: false },
  { id: 'arch_listener', label: 'Listener', description: 'Reacts to an event. May dispatch jobs or call services.', color: '#fb923c', icon: '◁', deletable: true, renameable: true, openable: false },
  { id: 'arch_job', label: 'Job', description: 'Background task dispatched to queue. Runs async.', color: '#facc15', icon: '↻', deletable: true, renameable: true, openable: false },
  { id: 'arch_middleware', label: 'Middleware', description: 'Intercepts before controller. Auth, throttle, CORS, logging.', color: '#94a3b8', icon: '⇥', deletable: true, renameable: true, openable: false },
  { id: 'arch_router', label: 'Router', description: 'Routes incoming requests to handlers.', color: '#38bdf8', icon: '⇢', deletable: true, renameable: true, openable: false },
  { id: 'arch_form_request', label: 'Form Request', description: 'Validates and transforms input before business logic.', color: '#a78bfa', icon: '✦', deletable: true, renameable: true, openable: false },
  { id: 'arch_resource', label: 'Resource', description: 'Formats data to JSON for the response (serialiser/transformer).', color: '#c084fc', icon: '⊠', deletable: true, renameable: true, openable: false },
  { id: 'arch_response', label: 'Response', description: 'Structured response returned to the caller.', color: '#4a9eff', icon: '↩', deletable: true, renameable: true, openable: false },
  { id: 'arch_database', label: 'Database', description: 'Physical storage. Postgres, MySQL, MongoDB, SQLite.', color: '#22d3ee', icon: '▣', deletable: true, renameable: true, openable: false },
  { id: 'arch_eloquent', label: 'Eloquent', description: 'Eloquent ORM model.', color: '#a78bfa', icon: '⊟', deletable: true, renameable: true, openable: false },
  { id: 'arch_orm', label: 'ORM', description: 'Object-relational mapping layer.', color: '#22d3ee', icon: '⊞', deletable: true, renameable: true, openable: false },
  { id: 'arch_migration', label: 'Migration', description: 'Versioned database schema change.', color: '#34d399', icon: '⊛', deletable: true, renameable: true, openable: false },
  { id: 'arch_seeder', label: 'Seeder', description: 'Populates database with seed data for testing or defaults.', color: '#22d3ee', icon: '◎', deletable: true, renameable: true, openable: false },
  { id: 'arch_factory', label: 'Factory', description: 'Creates instances of entities or models for testing.', color: '#facc15', icon: '⊕', deletable: true, renameable: true, openable: false },
  { id: 'arch_di_container', label: 'DI Container', description: 'Dependency injection container wiring.', color: '#4a9eff', icon: '⬖', deletable: true, renameable: true, openable: false },
  { id: 'arch_component', label: 'Component', description: 'Generic reusable architectural component.', color: '#6b7280', icon: '▣', deletable: true, renameable: true, openable: false },
  { id: 'arch_blank', label: 'Blank', description: 'Custom node. Edit label and description freely.', color: '#4b5563', icon: '○', deletable: true, renameable: true, openable: false },
];
