/**
 * Matrix of allowed connections between node types.
 *
 * Supports:
 * - base (framework-agnostic/default) rules
 * - per-adapter overrides (e.g. laravel, nestjs)
 *
 * Rule: source type -> allowed target types.
 * If a connection is not in the allowed set, it is forbidden.
 */
import { ADAPTER_CONNECTION_RULES, type ConnectionRules } from './connectionRules';


/** Normalize node type for matrix lookup (e.g. application_service → service). */
export function normalizeNodeTypeForMatrix(type: string): string {
  switch (type) {
    case 'application_service':
      return 'service';
    case 'infrastructure_repository':
      return 'repository';
    default:
      return type;
  }
}

/** Base fallback matrix used when adapter-specific rules are not provided. */
export const BASE_ALLOWED_CONNECTIONS: Record<string, readonly string[]> = {
  entry: [],
};
export const BASE_FORBIDDEN_CONNECTIONS: Record<string, readonly string[]> = {};

const adapterConnectionRules = new Map<string, ConnectionRules>();

/** Register (or replace) adapter-specific connection rules. */
export function registerAdapterConnectionRules(adapterId: string, rules: ConnectionRules): void {
  adapterConnectionRules.set(adapterId, rules);
}

/** Remove adapter-specific connection rules (e.g. on project close). */
export function clearAdapterConnectionRules(adapterId: string): void {
  adapterConnectionRules.delete(adapterId);
}

function resolveRules(adapterId?: string): {
  allowed: Record<string, readonly string[]>;
  forbidden: Record<string, readonly string[]>;
} {
  if (!adapterId) return { allowed: BASE_ALLOWED_CONNECTIONS, forbidden: BASE_FORBIDDEN_CONNECTIONS };
  const rules = adapterConnectionRules.get(adapterId) ?? ADAPTER_CONNECTION_RULES[adapterId];
  return {
    allowed: rules?.allowed ?? BASE_ALLOWED_CONNECTIONS,
    forbidden: rules?.forbidden ?? BASE_FORBIDDEN_CONNECTIONS,
  };
}

/** Check if connection source -> target is allowed. */
export function isConnectionAllowed(sourceType: string, targetType: string, adapterId?: string): boolean {
  const { allowed: ALLOWED_CONNECTIONS, forbidden: FORBIDDEN_CONNECTIONS } = resolveRules(adapterId);
  const src = normalizeNodeTypeForMatrix(sourceType);
  const tgt = normalizeNodeTypeForMatrix(targetType);

  const forbidden = FORBIDDEN_CONNECTIONS[src];
  if (forbidden?.includes(tgt)) return false;

  const allowed = ALLOWED_CONNECTIONS[src];
  if (!allowed) return false; // unknown source: deny
  if (allowed.length === 0) return false; // explicitly no connections

  return allowed.includes(tgt);
}

/** Get human-readable list of allowed targets for a source type. */
export function getAllowedTargets(sourceType: string, adapterId?: string): string[] {
  const { allowed: ALLOWED_CONNECTIONS, forbidden: FORBIDDEN_CONNECTIONS } = resolveRules(adapterId);
  const src = normalizeNodeTypeForMatrix(sourceType);
  const allowed = ALLOWED_CONNECTIONS[src] ?? [];
  const forbidden = FORBIDDEN_CONNECTIONS[src] ?? [];
  return allowed.filter((t) => !forbidden.includes(t));
}

/** Target types where we show method extraction step (Service, Job, Repository). */
export const EXTRACTION_TARGET_TYPES = new Set(['service', 'job', 'repository']);
