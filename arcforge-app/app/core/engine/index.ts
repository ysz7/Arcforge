/**
 * Core engine — analysis orchestration, detection, file watching.
 * Depends on graph and ports only.
 */

export { AnalysisEngine, type AnalysisEngineOptions, type GraphUpdateListener } from './AnalysisEngine';
export { ProjectDetector } from './ProjectDetector';
export { FileWatcher, type FileWatcherOptions, type FileWatcherCallback, type FileWatcherEvent } from './FileWatcher';
