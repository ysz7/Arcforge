/**
 * Preload script — exposes safe IPC API to the renderer.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('arcforge', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    onPrepareClose: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('window:prepareClose', handler);
      return () => ipcRenderer.removeListener('window:prepareClose', handler);
    },
    readyToClose: () => ipcRenderer.send('window:readyToClose'),
    cancelClose: () => ipcRenderer.send('window:cancelClose'),
  },
  view: {
    getState: () => ipcRenderer.invoke('view:getState'),
    setState: (state: { explorer?: boolean; sourceControl?: boolean; tasks?: boolean; testResults?: boolean; issues?: boolean }) =>
      ipcRenderer.invoke('view:setState', state),
    onStateChanged: (callback: (state: { explorer: boolean; sourceControl: boolean; tasks: boolean; testResults: boolean; issues: boolean }) => void) => {
      const handler = (_: unknown, state: Parameters<typeof callback>[0]) => callback(state);
      ipcRenderer.on('view:stateChanged', handler);
      return () => ipcRenderer.removeListener('view:stateChanged', handler);
    },
  },
  project: {
    open: () => ipcRenderer.invoke('project:open'),
    openJson: () => ipcRenderer.invoke('project:openJson'),
    createArchitecture: () => ipcRenderer.invoke('project:createArchitecture'),
    openArchitecture: () => ipcRenderer.invoke('project:openArchitecture'),
    openWithPlugin: (pluginId: string) => ipcRenderer.invoke('project:openWithPlugin', pluginId),
    createWithPlugin: (pluginId: string) => ipcRenderer.invoke('project:createWithPlugin', pluginId),
    close: () => ipcRenderer.invoke('project:close'),
    onOpened: (callback: (payload: { projectPath: string; adapterId: string; entryFile?: string; pluginInfo?: import('../shared/types/plugin').PluginInfo }) => void) => {
      const handler = (_: unknown, payload: { projectPath: string; adapterId: string; entryFile?: string; pluginInfo?: import('../shared/types/plugin').PluginInfo }) => callback(payload);
      ipcRenderer.on('project:opened', handler);
      return () => ipcRenderer.removeListener('project:opened', handler);
    },
    onClosed: (callback: () => void) => {
      ipcRenderer.on('project:closed', callback);
      return () => ipcRenderer.removeListener('project:closed', callback);
    },
    onOpenError: (callback: (error: string) => void) => {
      const handler = (_: unknown, error: string) => callback(error);
      ipcRenderer.on('project:open-error', handler);
      return () => ipcRenderer.removeListener('project:open-error', handler);
    },
  },
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    importPlugin: () => ipcRenderer.invoke('plugins:import'),
    deletePlugin: (pluginId: string) => ipcRenderer.invoke('plugins:delete', pluginId),
    revealPlugin: (pluginId: string) => ipcRenderer.invoke('plugins:reveal', pluginId),
    createPlugin: (opts: { id: string; name: string; author: string; accepts: 'directory' | 'file' }) =>
      ipcRenderer.invoke('plugins:create', opts),
    getCapabilities: () => ipcRenderer.invoke('plugins:getCapabilities'),
    reload: () => ipcRenderer.invoke('plugin:reload'),
    onNodeClick: (node: { id: string; type: string; filePath?: string; data?: Record<string, unknown> }) =>
      ipcRenderer.invoke('plugin:onNodeClick', node),
    onNodeEdit: (node: { id: string; type: string; data?: Record<string, unknown> }, changes: Record<string, unknown>) =>
      ipcRenderer.invoke('plugin:onNodeEdit', node, changes),
    onNodeCreate: (type: string, position: { x: number; y: number }) =>
      ipcRenderer.invoke('plugin:onNodeCreate', type, position),
    onNodeDelete: (node: { id: string; type: string }) =>
      ipcRenderer.invoke('plugin:onNodeDelete', node),
    onEdgeCreate: (source: { id: string; type: string }, target: { id: string; type: string }, edgeType?: string) =>
      ipcRenderer.invoke('plugin:onEdgeCreate', source, target, edgeType),
    onSave: () => ipcRenderer.invoke('plugin:onSave'),
    onExport: (options?: { language?: string; framework?: string; outputType?: string }) =>
      ipcRenderer.invoke('plugin:onExport', options),
  },
  analysis: {
    onStatus: (callback: (status: import('../shared/types').AnalysisStatus) => void) => {
      const handler = (_: unknown, status: import('../shared/types').AnalysisStatus) => callback(status);
      ipcRenderer.on('analysis:status', handler);
      return () => ipcRenderer.removeListener('analysis:status', handler);
    },
  },
  graph: {
    get: () => ipcRenderer.invoke('graph:get'),
    onUpdated: (callback: (payload: { graph: { nodes: unknown[]; edges: unknown[] }; issues: Array<{ filePath?: string; line?: number; message: string }> }) => void) => {
      ipcRenderer.on('graph:updated', (_event, payload) => callback(payload));
    },
    subscribe: () => ipcRenderer.invoke('graph:subscribe'),
    deleteNode: (nodeId: string, mode: 'node' | 'flow' | 'chain') =>
      ipcRenderer.invoke('graph:deleteNode', nodeId, mode),
    addConnection: (params: {
      source: string;
      sourceHandle: string | null;
      target: string;
      targetHandle: string | null;
    }) => ipcRenderer.invoke('graph:addConnection', params),
    addNode: (params: { type: string; label?: string; position: { x: number; y: number } }) =>
      ipcRenderer.invoke('graph:addNode', params),
    deleteEdge: (edgeId: string) => ipcRenderer.invoke('graph:deleteEdge', edgeId),
    renameNode: (nodeId: string, label: string) =>
      ipcRenderer.invoke('graph:renameNode', nodeId, label),
  },
  git: {
    status: (projectPath: string) => ipcRenderer.invoke('git:status', projectPath),
    diff: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('git:diff', projectPath, relativePath),
    stage: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('git:stage', projectPath, relativePath),
    unstage: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('git:unstage', projectPath, relativePath),
    commit: (projectPath: string, message: string) =>
      ipcRenderer.invoke('git:commit', projectPath, message),
  },
  shell: {
    run: (projectPath: string, command: string) =>
      ipcRenderer.invoke('shell:run', projectPath, command),
  },
  phpunit: {
    run: (projectPath: string, filter?: string) =>
      ipcRenderer.invoke('phpunit:run', projectPath, filter),
  },
  fs: {
    listDir: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('fs:listDir', projectPath, relativePath),
    readFile: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('fs:readFile', projectPath, relativePath),
    writeFile: (projectPath: string, relativePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', projectPath, relativePath, content),
    mkdir: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('fs:mkdir', projectPath, relativePath),
    deletePath: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('fs:deletePath', projectPath, relativePath),
    renamePath: (projectPath: string, fromRelative: string, toRelative: string) =>
      ipcRenderer.invoke('fs:renamePath', projectPath, fromRelative, toRelative),
    revealInExplorer: (projectPath: string, relativePath: string) =>
      ipcRenderer.invoke('fs:revealInExplorer', projectPath, relativePath),
  },
  forge: {
    getBlueprints: (nodeType: string) =>
      ipcRenderer.invoke('forge:blueprints', nodeType),
    preview: (blueprintName: string, sourceNodeId: string, params: Record<string, string>) =>
      ipcRenderer.invoke('forge:preview', blueprintName, sourceNodeId, params),
    execute: (blueprintName: string, sourceNodeId: string, params: Record<string, string>) =>
      ipcRenderer.invoke('forge:execute', blueprintName, sourceNodeId, params),
    rollback: (backupId: string) =>
      ipcRenderer.invoke('forge:rollback', backupId),
    confirmPending: (backupId: string) =>
      ipcRenderer.invoke('forge:confirmPending', backupId) as Promise<{ ok: boolean; error?: string }>,
    confirmPendingFile: (backupId: string, filePath: string) =>
      ipcRenderer.invoke('forge:confirmPendingFile', backupId, filePath) as Promise<{
        ok: boolean;
        error?: string;
      }>,
    discardPending: (backupId: string) =>
      ipcRenderer.invoke('forge:discardPending', backupId) as Promise<{ ok: boolean; error?: string }>,
    rollbackPendingFile: (backupId: string, filePath: string) =>
      ipcRenderer.invoke('forge:rollbackPendingFile', backupId, filePath) as Promise<{
        ok: boolean;
        error?: string;
      }>,
  },
  external: {
    open: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  updates: {
    getStatus: () => ipcRenderer.invoke('updates:getStatus'),
    checkNow: () => ipcRenderer.invoke('updates:checkNow'),
  },
});
