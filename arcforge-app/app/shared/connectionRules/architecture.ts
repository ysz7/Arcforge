import type { ConnectionRules } from './types';

const ARCH_NODES = [
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
] as const;

type ArchNode = (typeof ARCH_NODES)[number];

const allArch: readonly ArchNode[] = [...ARCH_NODES];

const allowedFrom: Record<string, readonly string[]> = {} as Record<ArchNode, readonly string[]>;
for (const n of ARCH_NODES) {
  allowedFrom[n] = allArch.filter((t) => t !== n);
}

/**
 * Architecture adapter: any arch node can connect to any other arch node (except self).
 */
export const ARCHITECTURE_CONNECTION_RULES: ConnectionRules = {
  allowed: {
    arch_entry: allArch.filter((t) => t !== 'arch_entry'),
    ...allowedFrom,
  },
  forbidden: {},
};
