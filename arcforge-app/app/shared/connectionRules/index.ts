import type { ConnectionRules } from './types';
import { ARCHITECTURE_CONNECTION_RULES } from './architecture';

/**
 * Built-in per-adapter connection rule sets.
 */
export const ADAPTER_CONNECTION_RULES: Record<string, ConnectionRules> = {
  arcspec: ARCHITECTURE_CONNECTION_RULES,
};

export type { ConnectionRules } from './types';
