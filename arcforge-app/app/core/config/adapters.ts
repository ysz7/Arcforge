/**
 * Framework adapter registry — single place to configure adapters.
 * Add new adapters here (e.g. via plugins system) for multi-framework support.
 */

import type { FrameworkAdapter } from '../ports';

export const ADAPTERS: FrameworkAdapter[] = [];
