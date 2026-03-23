/**
 * Blueprints for adding architecture nodes — Domain, Service, Module, etc.
 * Each creates a new node and an edge from the source node.
 */

import type { Blueprint, ForgeContext, ValidationResult, FileMutation, GraphMutation } from '../../../forge/types';
import type { GraphNodeType } from '../../../graph/types';

const ARCH_NODE_BLUEPRINTS: Array<{ type: string; displayName: string; description: string; category: string }> = [
  { type: 'arch_domain', displayName: 'Add Domain', description: 'Add a domain (DDD, Clean Architecture)', category: 'DDD' },
  { type: 'arch_aggregate', displayName: 'Add Aggregate', description: 'Add an aggregate root (DDD)', category: 'DDD' },
  { type: 'arch_bounded_context', displayName: 'Add Bounded Context', description: 'Add a bounded context (DDD)', category: 'DDD' },
  { type: 'arch_application_service', displayName: 'Add Application Service', description: 'Add an application service (DDD)', category: 'DDD' },
  { type: 'arch_domain_event', displayName: 'Add Domain Event', description: 'Add a domain event (DDD)', category: 'DDD' },
  { type: 'arch_entity', displayName: 'Add Entity', description: 'Add an entity', category: 'General' },
  { type: 'arch_value_object', displayName: 'Add Value Object', description: 'Add a value object (DDD)', category: 'General' },
  { type: 'arch_service', displayName: 'Add Service', description: 'Add a domain or application service', category: 'General' },
  { type: 'arch_use_case', displayName: 'Add Use Case', description: 'Add a use case (DDD, Clean Architecture)', category: 'General' },
  { type: 'arch_interface', displayName: 'Add Interface', description: 'Add an interface (contract)', category: 'General' },
  { type: 'arch_entry_interface', displayName: 'Add Presentation', description: 'Presentation layer (Clean Architecture): HTTP, CLI, gRPC', category: 'General' },
  { type: 'arch_repository', displayName: 'Add Repository', description: 'Add a repository', category: 'General' },
  { type: 'arch_repository_interface', displayName: 'Add Repository Interface', description: 'Repository port/interface (Clean Architecture)', category: 'General' },
  { type: 'arch_module', displayName: 'Add Module', description: 'Add a module (Modular/Monolith)', category: 'General' },
  { type: 'arch_layer', displayName: 'Add Layer', description: 'Add a layer (Layered, Clean)', category: 'General' },
  { type: 'arch_model', displayName: 'Add Model', description: 'Add a model (MVC)', category: 'General' },
  { type: 'arch_view', displayName: 'Add View', description: 'Add a view (MVC)', category: 'General' },
  { type: 'arch_controller', displayName: 'Add Controller', description: 'Add a controller (MVC)', category: 'General' },
  { type: 'arch_microservice', displayName: 'Add Microservice', description: 'Add a microservice', category: 'Microservices' },
  { type: 'arch_event', displayName: 'Add Event', description: 'Add an event (Event-Driven)', category: 'Event-Driven' },
  { type: 'arch_handler', displayName: 'Add Handler', description: 'Add an event handler', category: 'Event-Driven' },
  { type: 'arch_listener', displayName: 'Add Listener', description: 'Add an event listener', category: 'Event-Driven' },
  { type: 'arch_job', displayName: 'Add Job', description: 'Add a queue job', category: 'Event-Driven' },
  { type: 'arch_middleware', displayName: 'Add Middleware', description: 'Add HTTP middleware', category: 'MVC' },
  { type: 'arch_router', displayName: 'Add Router', description: 'Add a router', category: 'MVC' },
  { type: 'arch_form_request', displayName: 'Add Form Request', description: 'Add form validation', category: 'MVC' },
  { type: 'arch_resource', displayName: 'Add Resource/Serialiser', description: 'Formats data to JSON for the response (API resource / serialiser, framework-agnostic)', category: 'General' },
  { type: 'arch_response', displayName: 'Add Response', description: 'Add response (JSON/View)', category: 'General' },
  { type: 'arch_database', displayName: 'Add Database', description: 'Add database connection', category: 'General' },
  { type: 'arch_eloquent', displayName: 'Add Eloquent', description: 'Add Eloquent model / ORM (Laravel)', category: 'General' },
  { type: 'arch_orm', displayName: 'Add ORM', description: 'Add ORM (Object-Relational Mapping)', category: 'General' },
  { type: 'arch_migration', displayName: 'Add Migrations', description: 'Add database migrations (schema versioning)', category: 'General' },
  { type: 'arch_seeder', displayName: 'Add Seeders', description: 'Add database seeders (initial/test data)', category: 'General' },
  { type: 'arch_factory', displayName: 'Add Factory', description: 'Add model factory (test/fake data)', category: 'General' },
  { type: 'arch_di_container', displayName: 'Add DI Container', description: 'Dependency Injection container (wires and resolves dependencies)', category: 'General' },
  { type: 'arch_component', displayName: 'Add Component', description: 'Add a generic component', category: 'General' },
];

function createAddNodeBlueprint(spec: {
  type: string;
  displayName: string;
  description: string;
  category: string;
}): Blueprint {
  const name = `arch-add-${spec.type.replace('arch_', '')}`;
  return {
    name,
    displayName: spec.displayName,
    description: spec.description,
    category: spec.category,
    supportedNodeTypes: [
      'arch_entry',
      'arch_entry_interface',
      'arch_domain',
      'arch_aggregate',
      'arch_bounded_context',
      'arch_application_service',
      'arch_domain_event',
      'arch_entity',
      'arch_value_object',
      'arch_service',
      'arch_use_case',
      'arch_interface',
      'arch_repository',
      'arch_repository_interface',
      'arch_module',
      'arch_layer',
      'arch_model',
      'arch_view',
      'arch_controller',
      'arch_microservice',
      'arch_event',
      'arch_handler',
      'arch_listener',
      'arch_job',
      'arch_middleware',
      'arch_router',
      'arch_form_request',
      'arch_resource',
      'arch_response',
      'arch_database',
      'arch_eloquent',
      'arch_orm',
      'arch_migration',
      'arch_seeder',
      'arch_factory',
      'arch_di_container',
      'arch_component',
    ],
    params: [
      {
        name: 'label',
        label: 'Name',
        required: true,
        default: spec.displayName.replace('Add ', ''),
      },
    ],
    async validate(ctx: ForgeContext): Promise<ValidationResult> {
      const label = (ctx.params.label ?? '').trim();
      if (!label) {
        return { valid: false, errors: ['Name is required'], warnings: [], conflicts: [] };
      }
      return { valid: true, errors: [], warnings: [], conflicts: [] };
    },
    async generate(ctx: ForgeContext): Promise<{ mutations: FileMutation[]; graphMutations: GraphMutation }> {
      const label = (ctx.params.label ?? spec.displayName.replace('Add ', '')).trim();
      const newNodeId = `arch:${spec.type}:${Date.now()}:${label.replace(/\s/g, '_')}`;
      const newEdgeId = `arch:edge:${ctx.sourceNode.id}:${newNodeId}:${Date.now()}`;

      const entryFile = ctx.sourceNode.filePath ?? '';
      const newNodes: GraphMutation['newNodes'] = [
        {
          id: newNodeId,
          type: spec.type as GraphNodeType,
          filePath: entryFile,
          label,
          metadata: {},
        },
      ];
      const newEdges: GraphMutation['newEdges'] = [
        {
          id: newEdgeId,
          from: ctx.sourceNode.id,
          to: newNodeId,
          type: 'arch_dependency',
        },
      ];

      return {
        mutations: [],
        graphMutations: { newNodes, newEdges },
      };
    },
  };
}

export const ARCH_ADD_NODE_BLUEPRINTS: Blueprint[] = ARCH_NODE_BLUEPRINTS.map((s) =>
  createAddNodeBlueprint(s)
);
