/**
 * Adapter-specific connection rules contract.
 */
export interface ConnectionRules {
  allowed?: Record<string, readonly string[]>;
  forbidden?: Record<string, readonly string[]>;
}

