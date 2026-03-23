/**
 * Graph layer — domain model and in-memory store.
 * No dependencies on Electron, UI, or framework adapters.
 */

export * from './types';
export { GraphStore } from './store';
export { getNodesToDelete, DELETABLE_NODE_TYPES, type DeleteMode } from './deleteNode';
