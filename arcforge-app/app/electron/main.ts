/**
 * Electron main process — window, IPC handlers, and core engine wiring.
 */

import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import chokidar from 'chokidar';

import { ADAPTERS } from '../core/config/adapters';
import { AnalysisEngine } from '../core/engine';
import { getNodesToDelete, DELETABLE_NODE_TYPES } from '../core/graph';
import { isConnectionAllowed } from '../shared/allowedConnections';
import { APP_VERSION, UPDATES_JSON_URL, type UpdateStatus, type UpdatesJson } from '../shared/appInfo';
import {
  isArchitectureDocument,
  createEmptyArchitecture,
} from '../core/frameworks/architecture/types';
import {
  ArchitectureAdapter,
  persistArchitectureToFile,
} from '../core/frameworks/architecture/ArchitectureAdapter';
import type { ArcforgePlugin, PluginCapabilities, PluginNodeTypeDef } from '../shared/types/plugin';

// ---------------------------------------------------------------------------
// App lifecycle and window
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let analysisEngine: AnalysisEngine;
let activePlugin: ArcforgePlugin | null = null;
let activeProjectPath: string | null = null;
let activePluginDir: string | null = null;
let activePluginSource: 'builtin' | 'user' = 'builtin';
let activePluginEntryPath: string | null = null;
let pluginFileWatcher: chokidar.FSWatcher | null = null;

/** Default capabilities — most restrictive, safe for unknown plugins. */
const DEFAULT_CAPABILITIES: PluginCapabilities = {
  openFileOnNodeClick: true,
  editNodes: true,
  addNodes: false,
  deleteNodes: false,
  addEdges: false,
  deleteEdges: false,
  saveGraph: true,
  exportPrompt: true,
};

function getUserPluginsDir(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electronApp = require('electron').app as typeof import('electron').app;
  const documentsPath = electronApp.getPath('documents');
  return path.join(documentsPath, 'Arcforge', 'Plugins');
}

function ensureUserPluginsDir(): void {
  try {
    const dir = getUserPluginsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Copy SDK and type definitions to user plugins dir so plugins can require('../arcforge-sdk')
    const sdkSrc = path.join(__dirname, '../plugins/arcforge-sdk.js');
    const sdkDst = path.join(dir, '../arcforge-sdk.js'); // ~/Documents/Arcforge/arcforge-sdk.js
    if (fs.existsSync(sdkSrc) && !fs.existsSync(sdkDst)) {
      fs.copyFileSync(sdkSrc, sdkDst);
    } else if (fs.existsSync(sdkSrc)) {
      // Always update SDK to latest version
      fs.copyFileSync(sdkSrc, sdkDst);
    }
    // Copy type definitions
    const dtsSrc = path.join(__dirname, '../plugins/arcforge.d.ts');
    const dtsDst = path.join(dir, '../arcforge.d.ts');
    if (fs.existsSync(dtsSrc)) {
      fs.copyFileSync(dtsSrc, dtsDst);
    }
  } catch {
    // Non-fatal
  }
}

/** Built-in plugins dir = dist/plugins/ (relative to dist/electron/main.js) */
function getBuiltinPluginsDir(): string {
  return path.join(__dirname, '../plugins');
}

/** Stop watching plugin source files (if any watcher is active). */
function stopPluginHotReload(): void {
  if (pluginFileWatcher) {
    pluginFileWatcher.close();
    pluginFileWatcher = null;
  }
}

/**
 * Watch parser.js / nodes.js / manifest.json inside the plugin folder.
 * On change: clear require cache, reload plugin, re-parse, push graph:updated to renderer.
 */
function startPluginHotReload(pluginDir: string, source: 'builtin' | 'user', entryPath: string): void {
  stopPluginHotReload();

  const watchGlob = [
    path.join(pluginDir, 'parser.js'),
    path.join(pluginDir, 'nodes.js'),
    path.join(pluginDir, 'manifest.json'),
  ];

  let debounce: ReturnType<typeof setTimeout> | null = null;

  pluginFileWatcher = chokidar.watch(watchGlob, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150 },
  });

  pluginFileWatcher.on('all', () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      // Invalidate require cache for all JS files in the plugin folder
      for (const key of Object.keys(require.cache)) {
        if (key.startsWith(pluginDir + path.sep) || key.startsWith(pluginDir + '/')) {
          delete require.cache[key];
        }
      }

      const reloaded = loadManifestPlugin(pluginDir, source);
      if (!reloaded) return;

      activePlugin = reloaded;

      try {
        const result = await reloaded.parseProject(entryPath, {
          onProgress: (msg) => mainWindow?.webContents.send('analysis:status', { message: msg }),
        });
        const store = analysisEngine.getGraphStore();
        store.setGraph(result.graph);
        mainWindow?.webContents.send('graph:updated', { graph: result.graph, issues: result.errors ?? [] });
        mainWindow?.webContents.send('analysis:status', { message: 'Plugin reloaded' });
      } catch (err) {
        mainWindow?.webContents.send('analysis:status', { message: `Plugin reload error: ${err instanceof Error ? err.message : String(err)}` });
      }
    }, 300);
  });
}

/**
 * Load a plugin from manifest.json + parser.js.
 * Works for both built-in (dist/plugins/) and user (~/Documents/Arcforge/Plugins/) plugins.
 * Returns null if the folder is not a valid manifest-based plugin.
 */
function loadManifestPlugin(pluginDir: string, source: 'builtin' | 'user'): ArcforgePlugin | null {
  const manifestPath = path.join(pluginDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  const id = manifest['id'];
  const name = manifest['name'];
  const parserFile = manifest['parser'];
  const acceptsRaw = manifest['accepts'];
  if (typeof id !== 'string' || typeof name !== 'string' || typeof parserFile !== 'string') return null;
  if (acceptsRaw !== 'directory' && acceptsRaw !== 'file') return null;

  const parserPath = path.join(pluginDir, parserFile as string);
  if (!fs.existsSync(parserPath)) return null;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let parserMod: Record<string, unknown>;
  try {
    parserMod = require(parserPath) as Record<string, unknown>;
  } catch {
    return null;
  }

  const parseFn = (parserMod['parse'] ?? (parserMod['default'] as Record<string, unknown>)?.['parse']) as ((input: { path: string }) => Promise<{ nodes: unknown[]; edges: unknown[] }>) | undefined;
  if (typeof parseFn !== 'function') return null;

  // Controller methods (all optional)
  const reloadFn = parserMod['reload'] as ((input: { path: string }) => Promise<{ nodes: unknown[]; edges: unknown[] }>) | undefined;
  const onNodeClickFn = parserMod['onNodeClick'] as ((node: unknown) => Promise<unknown>) | undefined;
  const onNodeEditFn = parserMod['onNodeEdit'] as ((node: unknown, changes: unknown) => Promise<unknown>) | undefined;
  const onNodeCreateFn = parserMod['onNodeCreate'] as ((type: string, position: unknown) => Promise<unknown>) | undefined;
  const onNodeDeleteFn = parserMod['onNodeDelete'] as ((node: unknown) => Promise<unknown>) | undefined;
  const onEdgeCreateFn = parserMod['onEdgeCreate'] as ((source: unknown, target: unknown, type?: string) => Promise<unknown>) | undefined;
  const onSaveFn = parserMod['onSave'] as ((graph: unknown, context?: unknown) => Promise<unknown>) | undefined;
  const onExportFn = parserMod['onExport'] as ((graph: unknown, options?: unknown) => Promise<string>) | undefined;

  // Extended built-in-style exports (available to compiled built-in plugins)
  const persistGraphFn = parserMod['persistGraph'] as ((entryPath: string, graph: unknown) => { ok: boolean; error?: string }) | undefined;
  const createNewFn = parserMod['createNew'] as ((filePath: string) => { ok: boolean; error?: string }) | undefined;
  const isConnectionAllowedFn = parserMod['isConnectionAllowed'] as ((sourceType: string, targetType: string) => boolean) | undefined;
  const isDeletableFn = parserMod['isDeletable'] as ((nodeType: string) => boolean) | undefined;
  const getBlueprintsFn = parserMod['getBlueprints'] as (() => unknown[]) | undefined;
  const getWatchPatternsFn = parserMod['getWatchPatterns'] as (() => string[]) | undefined;

  // Load optional nodes.js
  let nodeTypes: PluginNodeTypeDef[] = [];
  const nodesFile = manifest['nodes'];
  if (typeof nodesFile === 'string') {
    const nodesPath = path.join(pluginDir, nodesFile);
    if (fs.existsSync(nodesPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodesDefs = require(nodesPath) as Array<{ id?: string; type?: string; label: string; description?: string; color?: string; icon?: string; deletable?: boolean; renameable?: boolean; openable?: boolean }>;
        if (Array.isArray(nodesDefs)) {
          nodeTypes = nodesDefs.map(d => ({
            id: d.id ?? d.type ?? d.label,
            label: d.label,
            description: d.description ?? '',
            color: d.color ?? '#6b6b7a',
            icon: d.icon ?? '◻',
            deletable: d.deletable ?? true,
            renameable: d.renameable ?? true,
            openable: d.openable ?? true,
          }));
        }
      } catch {
        // Skip invalid nodes.js
      }
    }
  }

  // Parse capabilities from manifest
  const manifestCaps = (manifest['capabilities'] ?? {}) as Record<string, boolean>;
  const capabilities: PluginCapabilities = {
    openFileOnNodeClick: manifestCaps['openFileOnNodeClick'] ?? DEFAULT_CAPABILITIES.openFileOnNodeClick,
    editNodes: manifestCaps['editNodes'] ?? DEFAULT_CAPABILITIES.editNodes,
    addNodes: manifestCaps['addNodes'] ?? DEFAULT_CAPABILITIES.addNodes,
    deleteNodes: manifestCaps['deleteNodes'] ?? DEFAULT_CAPABILITIES.deleteNodes,
    addEdges: manifestCaps['addEdges'] ?? DEFAULT_CAPABILITIES.addEdges,
    deleteEdges: manifestCaps['deleteEdges'] ?? DEFAULT_CAPABILITIES.deleteEdges,
    saveGraph: manifestCaps['saveGraph'] ?? DEFAULT_CAPABILITIES.saveGraph,
    exportPrompt: manifestCaps['exportPrompt'] ?? DEFAULT_CAPABILITIES.exportPrompt,
  };

  const fileTypesRaw = manifest['fileTypes'];
  const fileTypes: string[] = Array.isArray(fileTypesRaw) ? (fileTypesRaw as string[]) : [];
  const openMode = acceptsRaw === 'directory' ? 'folder' : 'file';
  const detectByRaw = manifest['detectBy'];
  const detectBy: string[] = Array.isArray(detectByRaw) ? (detectByRaw as string[]) : [];
  const canCreateNew = manifest['canCreateNew'] === true;

  const plugin: ArcforgePlugin & { _dir: string; _source: 'builtin' | 'user' } = {
    _dir: pluginDir,
    _source: source,
    id: id as string,
    name: name as string,
    description: typeof manifest['description'] === 'string' ? (manifest['description'] as string) : '',
    version: typeof manifest['version'] === 'string' ? (manifest['version'] as string) : '1.0.0',
    icon: typeof manifest['icon'] === 'string' ? (manifest['icon'] as string) : '◻',
    nodeTypes,
    openMode,
    fileFilters: fileTypes.length > 0
      ? [{ name: name as string, extensions: fileTypes.map(t => t.replace(/^\./, '')) }]
      : undefined,
    canCreateNew,
    source,
    capabilities,
    detectBy,

    async parseProject(entryPath, options) {
      options?.onProgress?.('Parsing…');
      const raw = await parseFn({ path: entryPath });

      // Normalize SDK output → GraphNode / GraphEdge shapes.
      // SDK nodes:  { id, type, filePath?, data: { name, ...rest } }
      // GraphNode:  { id, type, label, filePath, metadata }
      const rawNodes = (raw.nodes ?? []) as Array<Record<string, unknown>>;
      const rawEdges = (raw.edges ?? []) as Array<Record<string, unknown>>;

      const graphNodes = rawNodes.map((n) => {
        const data = (n['data'] as Record<string, unknown>) ?? {};
        const { name: _name, ...metaRest } = data as { name?: unknown; [k: string]: unknown };
        return {
          id: n['id'] as string,
          type: n['type'] as string,
          label: (n['label'] as string) ?? (data['name'] as string) ?? String(n['id']),
          filePath: (n['filePath'] as string) ?? (data['filePath'] as string) ?? '',
          metadata: metaRest as Record<string, unknown>,
        };
      });

      const graphEdges = rawEdges.map((e) => ({
        id: e['id'] as string,
        type: (e['type'] as string) ?? 'default',
        from: (e['from'] as string) ?? (e['source'] as string) ?? '',
        to: (e['to'] as string) ?? (e['target'] as string) ?? '',
      }));

      return {
        graph: {
          nodes: graphNodes as import('../shared/types/graph').GraphNode[],
          edges: graphEdges as import('../shared/types/graph').GraphEdge[],
        },
      };
    },

    isConnectionAllowed(sourceType, targetType) {
      if (isConnectionAllowedFn) return isConnectionAllowedFn(sourceType, targetType);
      return capabilities.addEdges;
    },

    isDeletable(nodeType) {
      if (isDeletableFn) return isDeletableFn(nodeType);
      return capabilities.deleteNodes;
    },

    getInfo() {
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        version: this.version,
        icon: this.icon,
        nodeTypes: this.nodeTypes,
        openMode: this.openMode,
        fileFilters: this.fileFilters,
        canCreateNew: this.canCreateNew,
        source: this.source,
        capabilities: this.capabilities,
        detectBy: this.detectBy,
      };
    },

    ...(persistGraphFn ? {
      persistGraph(entryPath: string, graph: import('../shared/types/graph').Graph) {
        return persistGraphFn(entryPath, graph) as { ok: boolean; error?: string };
      },
    } : {}),

    ...(createNewFn ? {
      createNew(filePath: string) {
        return createNewFn(filePath);
      },
    } : {}),

    ...(getBlueprintsFn ? { getBlueprints: getBlueprintsFn } : {}),
    ...(getWatchPatternsFn ? { getWatchPatterns: getWatchPatternsFn } : {}),

    ...(reloadFn ? {
      async reload(input: { path: string }) {
        const raw = await reloadFn(input);
        return {
          graph: {
            nodes: (raw.nodes ?? []) as import('../shared/types/graph').GraphNode[],
            edges: (raw.edges ?? []) as import('../shared/types/graph').GraphEdge[],
          },
        };
      },
    } : {}),

    ...(onNodeClickFn ? { onNodeClick: onNodeClickFn as ArcforgePlugin['onNodeClick'] } : {}),
    ...(onNodeEditFn ? { onNodeEdit: onNodeEditFn as ArcforgePlugin['onNodeEdit'] } : {}),
    ...(onNodeCreateFn ? { onNodeCreate: onNodeCreateFn as ArcforgePlugin['onNodeCreate'] } : {}),
    ...(onNodeDeleteFn ? { onNodeDelete: onNodeDeleteFn as ArcforgePlugin['onNodeDelete'] } : {}),
    ...(onEdgeCreateFn ? { onEdgeCreate: onEdgeCreateFn as ArcforgePlugin['onEdgeCreate'] } : {}),
    ...(onSaveFn ? {
      async onSave(graph: import('../shared/types/graph').Graph) {
        const res = await onSaveFn(graph, { entryPath: activeProjectPath ?? undefined });
        return res as { success: boolean; error?: string };
      },
    } : {}),
    ...(onExportFn ? { onExport: onExportFn as ArcforgePlugin['onExport'] } : {}),
  };

  return plugin;
}

function getAllPlugins(): ArcforgePlugin[] {
  const plugins: ArcforgePlugin[] = [];

  // 1. Built-in plugins from dist/plugins/
  try {
    const builtinDir = getBuiltinPluginsDir();
    if (fs.existsSync(builtinDir)) {
      const entries = fs.readdirSync(builtinDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pluginDir = path.join(builtinDir, entry.name);
        const plugin = loadManifestPlugin(pluginDir, 'builtin');
        if (plugin) plugins.push(plugin);
      }
    }
  } catch {
    // No built-in plugins dir
  }

  // 2. User plugins from ~/Documents/Arcforge/Plugins/
  try {
    const userPluginsDir = getUserPluginsDir();
    if (fs.existsSync(userPluginsDir)) {
      const entries = fs.readdirSync(userPluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pluginDir = path.join(userPluginsDir, entry.name);
        const plugin = loadManifestPlugin(pluginDir, 'user');
        if (plugin) plugins.push(plugin);
      }
    }
  } catch {
    // No user plugins
  }

  return plugins;
}
let viewState = {
  explorer: true,
  sourceControl: false,
  tasks: false,
  testResults: false,
  issues: false,
  minimapVisible: true,
  controlsVisible: false,
  editorLayoutMode: 'tab' as 'tab' | 'split',
};

let updateStatus: UpdateStatus = {
  currentVersion: APP_VERSION,
  latestVersion: null,
  minimumSupportedVersion: null,
  downloadUrl: null,
  changelogUrl: null,
  hasUpdate: false,
};

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

async function fetchUpdatesJson(): Promise<UpdatesJson> {
  return new Promise<UpdatesJson>((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const https = require('https') as typeof import('https');
      https
        .get(UPDATES_JSON_URL, (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} when fetching updates.json`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (d: Buffer) => chunks.push(d));
          res.on('end', () => {
            try {
              const text = Buffer.concat(chunks).toString('utf-8');
              const json = JSON.parse(text) as UpdatesJson;
              resolve(json);
            } catch (err) {
              reject(err);
            }
          });
        })
        .on('error', (err: unknown) => {
          reject(err);
        });
    } catch (err) {
      reject(err);
    }
  });
}

async function checkForUpdates(): Promise<UpdateStatus> {
  try {
    const json = await fetchUpdatesJson();
    const latest = json.latestVersion;
    const minSupported = json.minimumSupportedVersion ?? null;
    let downloadUrl: string | null = null;
    if (Array.isArray(json.downloads)) {
      const win = json.downloads.find((d) => d.os === 'windows' && d.arch === 'x64') ?? json.downloads[0];
      if (win?.url) downloadUrl = win.url;
    }
    const changelogUrl = json.changelogUrl ?? null;
    const hasUpdate = latest ? compareSemver(latest, APP_VERSION) > 0 : false;
    updateStatus = {
      currentVersion: APP_VERSION,
      latestVersion: latest ?? null,
      minimumSupportedVersion: minSupported,
      downloadUrl,
      changelogUrl,
      hasUpdate,
    };
  } catch (err) {
    updateStatus = {
      currentVersion: APP_VERSION,
      latestVersion: null,
      minimumSupportedVersion: null,
      downloadUrl: null,
      changelogUrl: null,
      hasUpdate: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return updateStatus;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../renderer/favicon.ico'),
  });

  const rendererPath = path.join(__dirname, '../renderer/index.html');
  mainWindow.loadFile(rendererPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercept close to save viewport/config before the renderer is destroyed
  let closing = false;
  let forceCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  let readyHandler: (() => void) | null = null;
  const clearCloseState = () => {
    if (forceCloseTimeout) {
      clearTimeout(forceCloseTimeout);
      forceCloseTimeout = null;
    }
    if (readyHandler) {
      ipcMain.removeListener('window:readyToClose', readyHandler);
      readyHandler = null;
    }
    closing = false;
  };
  mainWindow.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    mainWindow?.webContents.send('window:prepareClose');
    forceCloseTimeout = setTimeout(() => {
      forceCloseTimeout = null;
      if (readyHandler) ipcMain.removeListener('window:readyToClose', readyHandler);
      readyHandler = null;
      mainWindow?.destroy();
      mainWindow = null;
      closing = false;
    }, 5000);
    readyHandler = () => {
      clearCloseState();
      mainWindow?.destroy();
      mainWindow = null;
    };
    ipcMain.once('window:readyToClose', readyHandler);
  });
  ipcMain.on('window:cancelClose', () => {
    clearCloseState();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // Hide native menu — use custom TitleBar instead
  ensureUserPluginsDir();
  analysisEngine = new AnalysisEngine({ adapters: ADAPTERS });

  analysisEngine.onGraphUpdate((projectPath, adapterId) => {
    const store = analysisEngine.getGraphStore();
    const graph = store.getGraph();
    const issues = store.getAnalysisIssues();
    mainWindow?.webContents.send('graph:updated', { graph, issues });
  });

  analysisEngine.onStatusUpdate((status) => {
    mainWindow?.webContents.send('analysis:status', status);
  });

  registerIpcHandlers();
  createWindow();
  void checkForUpdates();
});

app.on('window-all-closed', () => {
  stopPluginHotReload();
  analysisEngine?.closeProject?.();
  app.quit();
});

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  // Window
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  // External browser
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (typeof url === 'string' && url.trim()) {
      shell.openExternal(url.trim());
    }
  });

  // View
  ipcMain.handle('view:getState', () => viewState);
  ipcMain.handle('view:setState', (_e, state: Partial<typeof viewState>) => {
    viewState = { ...viewState, ...state };
    mainWindow?.webContents.send('view:stateChanged', viewState);
  });

  // Project
  ipcMain.handle('project:createArchitecture', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Create new Architecture',
      defaultPath: 'architecture.json',
      filters: [{ name: 'Architecture JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, error: 'No path selected' };
    }
    const filePath = result.filePath.endsWith('.json') ? result.filePath : `${result.filePath}.json`;
    const doc = createEmptyArchitecture();
    try {
      fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mainWindow?.webContents.send('project:open-error', msg);
      return { ok: false, error: msg };
    }
    const { adapterId, error } = await analysisEngine.openArchitectureFile(filePath);
    if (error) {
      mainWindow?.webContents.send('project:open-error', error);
      return { ok: false, error };
    }
    const arcspecPlug = getAllPlugins().find(p => p.id === 'arcspec') ?? null;
    activePlugin = arcspecPlug;
    const projectPath = path.dirname(filePath);
    activeProjectPath = projectPath;
    const entryFileRelative = path.relative(projectPath, filePath).replace(/\\/g, '/');
    mainWindow?.webContents.send('project:opened', {
      projectPath,
      adapterId: adapterId ?? '',
      entryFile: entryFileRelative,
      pluginInfo: arcspecPlug?.getInfo() ?? undefined,
    });
    return { ok: true, projectPath, adapterId };
  });
  ipcMain.handle('project:openArchitecture', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open Architecture',
      properties: ['openFile'],
      filters: [{ name: 'Architecture JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'No file selected' };
    }
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (!isArchitectureDocument(parsed)) {
        mainWindow?.webContents.send('project:open-error', 'Selected file is not an Arcforge architecture document.');
        return { ok: false, error: 'Not an architecture document' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mainWindow?.webContents.send('project:open-error', msg);
      return { ok: false, error: msg };
    }
    const { adapterId, error } = await analysisEngine.openArchitectureFile(filePath);
    if (error) {
      mainWindow?.webContents.send('project:open-error', error);
      return { ok: false, error };
    }
    const arcspecPlug = getAllPlugins().find(p => p.id === 'arcspec') ?? null;
    activePlugin = arcspecPlug;
    const projectPath = path.dirname(filePath);
    const entryFileRelative = path.relative(projectPath, filePath).replace(/\\/g, '/');
    mainWindow?.webContents.send('project:opened', {
      projectPath,
      adapterId: adapterId ?? '',
      entryFile: entryFileRelative,
      pluginInfo: arcspecPlug?.getInfo() ?? undefined,
    });
    return { ok: true, projectPath, adapterId };
  });

  ipcMain.handle('project:openWithPlugin', async (_e, pluginId: string) => {
    stopPluginHotReload();
    const plugin = getAllPlugins().find(p => p.id === pluginId);
    if (!plugin) return { ok: false, error: 'Plugin not found' };

    const { dialog } = await import('electron');
    let filePath: string;

    if (plugin.openMode === 'file') {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: `Open ${plugin.name}`,
        properties: ['openFile'],
        filters: plugin.fileFilters ?? [{ name: 'All Files', extensions: ['*'] }],
      });
      if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'No file selected' };
      filePath = result.filePaths[0];
    } else {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: `Open ${plugin.name}`,
        properties: ['openDirectory'],
      });
      if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'No folder selected' };
      filePath = result.filePaths[0];
    }

    activePlugin = plugin;

    if (plugin.id === 'arcspec') {
      // Use existing AnalysisEngine path for arcspec
      const { adapterId, error } = await analysisEngine.openArchitectureFile(filePath);
      if (error) {
        mainWindow?.webContents.send('project:open-error', error);
        return { ok: false, error };
      }
      const projectPath = path.dirname(filePath);
      activeProjectPath = projectPath;
      const entryFileRelative = path.relative(projectPath, filePath).replace(/\\/g, '/');
      mainWindow?.webContents.send('project:opened', {
        projectPath,
        adapterId: adapterId ?? '',
        entryFile: entryFileRelative,
        pluginInfo: plugin.getInfo(),
      });
      return { ok: true, projectPath, adapterId };
    }

    // Generic plugin path
    analysisEngine.closeProject();
    const projectPath = plugin.openMode === 'folder' ? filePath : path.dirname(filePath);
    activeProjectPath = projectPath;
    activePluginEntryPath = filePath;
    const pluginMeta = plugin as ArcforgePlugin & { _dir?: string; _source?: 'builtin' | 'user' };
    if (pluginMeta._dir) startPluginHotReload(pluginMeta._dir, pluginMeta._source ?? 'user', filePath);

    // Register plugin blueprints with ForgeEngine
    const forge = analysisEngine.getForgeEngine();
    forge.registry.clear();
    if (plugin.getBlueprints) {
      for (const bp of plugin.getBlueprints()) {
        try { forge.registry.register(bp as import('../core/forge/types').Blueprint); } catch { /* skip duplicates */ }
      }
    }

    try {
      const result = await plugin.parseProject(filePath, {
        onProgress: (msg) => mainWindow?.webContents.send('analysis:status', { message: msg }),
      });
      const store = analysisEngine.getGraphStore();
      store.setProjectPath(projectPath);
      store.setGraph(result.graph);
      store.setAnalysisIssues([...(result.errors ?? []), ...(result.warnings ?? [])]);

      const entryFileRelative = plugin.openMode === 'file'
        ? path.relative(projectPath, filePath).replace(/\\/g, '/')
        : undefined;
      mainWindow?.webContents.send('project:opened', {
        projectPath,
        adapterId: plugin.id,
        entryFile: entryFileRelative,
        pluginInfo: plugin.getInfo(),
      });
      mainWindow?.webContents.send('graph:updated', { graph: result.graph, issues: result.errors ?? [] });
      return { ok: true, projectPath, adapterId: plugin.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      mainWindow?.webContents.send('project:open-error', error);
      return { ok: false, error };
    }
  });

  ipcMain.handle('project:createWithPlugin', async (_e, pluginId: string) => {
    stopPluginHotReload();
    const plugin = getAllPlugins().find(p => p.id === pluginId);
    if (!plugin) return { ok: false, error: 'Plugin not found' };
    if (!plugin.createNew) return { ok: false, error: 'Plugin does not support creating new files' };

    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: `Create new ${plugin.name}`,
      filters: plugin.fileFilters ?? [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, error: 'No path selected' };

    const filePath = result.filePath;
    const createResult = plugin.createNew(filePath);
    if (!createResult.ok) {
      mainWindow?.webContents.send('project:open-error', createResult.error);
      return { ok: false, error: createResult.error };
    }

    activePlugin = plugin;

    if (plugin.id === 'arcspec') {
      const { adapterId, error } = await analysisEngine.openArchitectureFile(filePath);
      if (error) {
        mainWindow?.webContents.send('project:open-error', error);
        return { ok: false, error };
      }
      const projectPath = path.dirname(filePath);
      const entryFileRelative = path.relative(projectPath, filePath).replace(/\\/g, '/');
      mainWindow?.webContents.send('project:opened', {
        projectPath,
        adapterId: adapterId ?? '',
        entryFile: entryFileRelative,
        pluginInfo: plugin.getInfo(),
      });
      return { ok: true, projectPath, adapterId };
    }

    // Generic plugin path
    analysisEngine.closeProject();
    const projectPath = path.dirname(filePath);
    activeProjectPath = projectPath;
    activePluginEntryPath = filePath;
    const pluginMetaCreate = plugin as ArcforgePlugin & { _dir?: string; _source?: 'builtin' | 'user' };
    if (pluginMetaCreate._dir) startPluginHotReload(pluginMetaCreate._dir, pluginMetaCreate._source ?? 'user', filePath);

    // Register plugin blueprints with ForgeEngine
    const forgeCreate = analysisEngine.getForgeEngine();
    forgeCreate.registry.clear();
    if (plugin.getBlueprints) {
      for (const bp of plugin.getBlueprints()) {
        try { forgeCreate.registry.register(bp as import('../core/forge/types').Blueprint); } catch { /* skip duplicates */ }
      }
    }

    try {
      const parseResult = await plugin.parseProject(filePath, {
        onProgress: (msg) => mainWindow?.webContents.send('analysis:status', { message: msg }),
      });
      const store = analysisEngine.getGraphStore();
      store.setProjectPath(projectPath);
      store.setGraph(parseResult.graph);
      store.setAnalysisIssues([...(parseResult.errors ?? []), ...(parseResult.warnings ?? [])]);

      mainWindow?.webContents.send('graph:updated', { graph: parseResult.graph, issues: parseResult.errors ?? [] });

      const entryFileRelative = path.relative(projectPath, filePath).replace(/\\/g, '/');
      mainWindow?.webContents.send('project:opened', {
        projectPath,
        adapterId: plugin.id,
        entryFile: entryFileRelative,
        pluginInfo: plugin.getInfo(),
      });
      return { ok: true, projectPath, adapterId: plugin.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      mainWindow?.webContents.send('project:open-error', error);
      return { ok: false, error };
    }
  });
  ipcMain.handle('project:close', () => {
    stopPluginHotReload();
    activePlugin = null;
    activeProjectPath = null;
    activePluginEntryPath = null;
    analysisEngine.closeProject();
    mainWindow?.webContents.send('project:closed');
    return { ok: true };
  });

  // Graph
  ipcMain.handle('graph:get', () => {
    const store = analysisEngine.getGraphStore();
    return {
      graph: store.getGraph(),
      issues: store.getAnalysisIssues(),
    };
  });
  ipcMain.handle('graph:subscribe', () => {
    // Subscription is implicit via onGraphUpdate; no-op
  });

  // Updates
  // Always refresh when renderer asks, so we don't depend on timing of app startup.
  ipcMain.handle('updates:getStatus', async () => {
    const status = await checkForUpdates();
    return status;
  });
  ipcMain.handle('updates:checkNow', async () => {
    const status = await checkForUpdates();
    return status;
  });

  ipcMain.handle(
    'graph:deleteNode',
    async (
      _e,
      nodeId: string,
      mode: 'node' | 'flow' | 'chain'
    ): Promise<{ ok: boolean; deleted?: string[]; error?: string }> => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };

      const graph = store.getGraph();
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return { ok: false, error: 'Node not found' };

      const canDelete = activePlugin ? activePlugin.isDeletable(node.type) : DELETABLE_NODE_TYPES.has(node.type);
      if (!canDelete) {
        const supported = Array.from(DELETABLE_NODE_TYPES).join(', ');
        return { ok: false, error: `Node type "${node.type}" cannot be deleted. Supported: ${supported}` };
      }

      // Main entry node (arch:entry) cannot be deleted
      if (node.type === 'arch_entry' && nodeId === 'arch:entry') {
        return { ok: false, error: 'Main entry node cannot be deleted' };
      }

      const idsToDelete = getNodesToDelete(graph, nodeId, mode);

      const idsSet = new Set(idsToDelete);
      const remainingNodes = graph.nodes.filter((n) => !idsSet.has(n.id));
      const remainingEdges = graph.edges.filter(
        (e) => !idsSet.has(e.from) && !idsSet.has(e.to)
      );
      store.setGraph({ nodes: remainingNodes, edges: remainingEdges });
      const entryFile = analysisEngine.getEntryFile?.();
      if (entryFile) {
        const res = activePlugin?.persistGraph
          ? activePlugin.persistGraph(entryFile, store.getGraph())
          : persistArchitectureToFile(entryFile, store.getGraph());
        if (!res.ok) {
          mainWindow?.webContents.send('project:open-error', res.error);
          return { ok: false, error: res.error };
        }
      }
      mainWindow?.webContents.send('graph:updated', {
        graph: store.getGraph(),
        issues: store.getAnalysisIssues(),
      });
      return { ok: true, deleted: idsToDelete };
    }
  );

  ipcMain.handle(
    'graph:addConnection',
    async (
      _e,
      params: { source: string; sourceHandle: string | null; target: string; targetHandle: string | null }
    ): Promise<{ ok: boolean; error?: string }> => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };

      const graph = store.getGraph();
      const sourceNode = graph.nodes.find((n) => n.id === params.source);
      const targetNode = graph.nodes.find((n) => n.id === params.target);
      if (!sourceNode || !targetNode) return { ok: false, error: 'Source or target node not found' };

      const sourceType = sourceNode.type;
      const targetType = targetNode.type;
      const adapterId = analysisEngine.getActiveAdapterId() ?? undefined;
      const connectionAllowed = activePlugin
        ? activePlugin.isConnectionAllowed(sourceType, targetType)
        : isConnectionAllowed(sourceType, targetType, adapterId);
      if (!connectionAllowed) {
        return { ok: false, error: `Connection ${sourceType} → ${targetType} is not allowed` };
      }

      const edgeId = `arch:edge:${params.source}:${params.target}:${Date.now()}`;
      const newEdge = {
        id: edgeId,
        from: params.source,
        to: params.target,
        type: 'arch_dependency' as const,
        sourceHandle: params.sourceHandle ?? undefined,
        targetHandle: params.targetHandle ?? undefined,
        metadata: {},
      };
      const newEdges = [...graph.edges, newEdge];
      store.setGraph({ nodes: graph.nodes, edges: newEdges });
      const entryFile = analysisEngine.getEntryFile?.();
      if (entryFile) {
        const res = activePlugin?.persistGraph
          ? activePlugin.persistGraph(entryFile, store.getGraph())
          : persistArchitectureToFile(entryFile, store.getGraph());
        if (!res.ok) return { ok: false, error: res.error };
      }
      mainWindow?.webContents.send('graph:updated', {
        graph: store.getGraph(),
        issues: store.getAnalysisIssues(),
      });
      return { ok: true };
    }
  );

  ipcMain.handle(
    'graph:addNode',
    async (
      _e,
      params: { type: string; label?: string; position: { x: number; y: number } }
    ): Promise<{ ok: boolean; nodeId?: string; error?: string }> => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };

      if (params.type !== 'arch_entry') return { ok: false, error: 'Only arch_entry can be added via addNode' };

      const graph = store.getGraph();
      const nodeId = `arch:entry:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const newNode = {
        id: nodeId,
        type: 'arch_entry' as const,
        filePath: '',
        label: params.label ?? 'Entry',
        metadata: {},
      };
      const newNodes = [...graph.nodes, newNode];
      store.setGraph({ nodes: newNodes, edges: graph.edges });
      const entryFile = analysisEngine.getEntryFile?.();
      if (entryFile) {
        const res = activePlugin?.persistGraph
          ? activePlugin.persistGraph(entryFile, store.getGraph())
          : persistArchitectureToFile(entryFile, store.getGraph());
        if (!res.ok) return { ok: false, error: res.error };
      }
      mainWindow?.webContents.send('graph:updated', {
        graph: store.getGraph(),
        issues: store.getAnalysisIssues(),
      });
      return { ok: true, nodeId };
    }
  );

  ipcMain.handle(
    'graph:deleteEdge',
    async (_e, edgeId: string): Promise<{ ok: boolean; error?: string }> => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };

      const graph = store.getGraph();
      const edge = graph.edges.find((e) => e.id === edgeId);
      if (!edge) return { ok: false, error: 'Edge not found' };

      const remainingEdges = graph.edges.filter((e) => e.id !== edgeId);
      store.setGraph({ nodes: graph.nodes, edges: remainingEdges });
      const entryFile = analysisEngine.getEntryFile?.();
      if (entryFile) {
        const res = activePlugin?.persistGraph
          ? activePlugin.persistGraph(entryFile, store.getGraph())
          : persistArchitectureToFile(entryFile, store.getGraph());
        if (!res.ok) return { ok: false, error: res.error };
      }
      mainWindow?.webContents.send('graph:updated', {
        graph: store.getGraph(),
        issues: store.getAnalysisIssues(),
      });
      return { ok: true };
    }
  );

  ipcMain.handle(
    'graph:renameNode',
    async (_e, nodeId: string, label: string): Promise<{ ok: boolean; error?: string }> => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };

      const graph = store.getGraph();
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return { ok: false, error: 'Node not found' };

      const trimmed = label.trim();
      if (!trimmed) return { ok: false, error: 'Name cannot be empty.' };

      const updatedNodes = graph.nodes.map((n) =>
        n.id === nodeId ? { ...n, label: trimmed } : n,
      );
      store.setGraph({ nodes: updatedNodes, edges: graph.edges });

      const entryFile = analysisEngine.getEntryFile?.();
      if (entryFile) {
        const res = activePlugin?.persistGraph
          ? activePlugin.persistGraph(entryFile, store.getGraph())
          : persistArchitectureToFile(entryFile, store.getGraph());
        if (!res.ok) return { ok: false, error: res.error };
      }

      mainWindow?.webContents.send('graph:updated', {
        graph: store.getGraph(),
        issues: store.getAnalysisIssues(),
      });

      return { ok: true };
    }
  );

  // Git
  ipcMain.handle('git:status', async (_e, projectPath: string) => {
    try {
      const { execSync } = await import('child_process');
      const out = execSync('git status --porcelain -u', { cwd: projectPath, encoding: 'utf-8' });
      const lines = out.trim().split('\n').filter(Boolean);
      const files: Array<{ path: string; status: string }> = [];
      for (const line of lines) {
        const code = line.slice(0, 2);
        const p = line.slice(3).trim();
        let status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' = 'modified';
        if (code.startsWith('??')) status = 'untracked';
        else if (code.startsWith('A') || code === ' M' || code === 'A ') status = 'added';
        else if (code.startsWith('D') || code === ' D') status = 'deleted';
        else if (code.startsWith('R')) status = 'renamed';
        else if (code.startsWith('M') || code.startsWith(' U')) status = 'modified';
        files.push({ path: p, status });
      }
      return { ok: true, files };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('git:diff', async (_e, projectPath: string, relativePath: string) => {
    try {
      const { execSync } = await import('child_process');
      const out = execSync(`git diff -- "${relativePath}"`, { cwd: projectPath, encoding: 'utf-8' });
      return { ok: true, content: out };
    } catch (err) {
      return { ok: false, content: null, error: String(err) };
    }
  });
  ipcMain.handle('git:stage', async (_e, projectPath: string, relativePath: string) => {
    try {
      const { execSync } = await import('child_process');
      execSync(`git add -- "${relativePath}"`, { cwd: projectPath });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('git:unstage', async (_e, projectPath: string, relativePath: string) => {
    try {
      const { execSync } = await import('child_process');
      execSync(`git reset -- "${relativePath}"`, { cwd: projectPath });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('git:commit', async (_e, projectPath: string, message: string) => {
    try {
      const { execSync } = await import('child_process');
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Shell
  ipcMain.handle('shell:run', async (_e, projectPath: string, command: string) => {
    try {
      const { execSync } = await import('child_process');
      const out = execSync(command, { cwd: projectPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return { ok: true, stdout: out, stderr: '', exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        ok: false,
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(err),
        exitCode: e.status ?? 1,
        error: String(err),
      };
    }
  });

  // FS
  ipcMain.handle('fs:listDir', async (_e, projectPath: string, relativePath: string) => {
    try {
      const abs = path.resolve(projectPath, relativePath);
      const entries = fs.readdirSync(abs, { withFileTypes: true });
      const skipDirs = new Set(['node_modules', 'vendor', '.git']);
      return {
        ok: true,
        entries: entries
          .filter((e) => !(e.isDirectory() && skipDirs.has(e.name)))
          .map((e) => ({ name: e.name, isDirectory: e.isDirectory() })),
      };
    } catch (err) {
      return { ok: false, entries: [], error: String(err) };
    }
  });
  ipcMain.handle('fs:readFile', async (_e, projectPath: string, relativePath: string) => {
    try {
      const abs = path.resolve(projectPath, relativePath);
      if (!fs.existsSync(abs)) return { ok: true, content: null };
      const content = fs.readFileSync(abs, 'utf-8');
      return { ok: true, content };
    } catch (err) {
      return { ok: false, content: null, error: String(err) };
    }
  });
  ipcMain.handle('fs:writeFile', async (_e, projectPath: string, relativePath: string, content: string) => {
    try {
      const abs = path.resolve(projectPath, relativePath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content, 'utf-8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('fs:mkdir', async (_e, projectPath: string, relativePath: string) => {
    try {
      const abs = path.resolve(projectPath, relativePath);
      fs.mkdirSync(abs, { recursive: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('fs:deletePath', async (_e, projectPath: string, relativePath: string) => {
    try {
      const abs = path.resolve(projectPath, relativePath);
      if (fs.existsSync(abs)) {
        fs.rmSync(abs, { recursive: true });
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('fs:renamePath', async (_e, projectPath: string, fromRelative: string, toRelative: string) => {
    try {
      const fromAbs = path.resolve(projectPath, fromRelative);
      const toAbs = path.resolve(projectPath, toRelative);
      fs.renameSync(fromAbs, toAbs);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('fs:revealInExplorer', async (_e, projectPath: string, relativePath: string) => {
    try {
      const abs = path.resolve(projectPath, relativePath);
      shell.showItemInFolder(abs);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Forge
  ipcMain.handle('forge:blueprints', async (_e, nodeType: string) => {
    const forge = analysisEngine.getForgeEngine();
    const infos = forge.getBlueprintsForNodeType(nodeType);
    return infos.map((bp) => ({
      name: bp.name,
      displayName: bp.displayName,
      description: bp.description,
      category: bp.category,
      supportedNodeTypes: bp.supportedNodeTypes,
      params: bp.params,
    }));
  });
  ipcMain.handle(
    'forge:preview',
    async (
      _e,
      blueprintName: string,
      sourceNodeId: string,
      params: Record<string, string>
    ) => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };
      const graph = store.getGraph();
      const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return { ok: false, error: 'Source node not found' };
      const forge = analysisEngine.getForgeEngine();
      try {
        const preview = await forge.preview(blueprintName, {
          projectPath,
          adapterId: analysisEngine.getActiveAdapterId() ?? '',
          sourceNode,
          existingNodes: graph.nodes,
          existingEdges: graph.edges,
          params: params ?? {},
        });
        return { ok: true, preview };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
  );
  ipcMain.handle(
    'forge:execute',
    async (
      _e,
      blueprintName: string,
      sourceNodeId: string,
      params: Record<string, string>
    ) => {
      const store = analysisEngine.getGraphStore();
      const projectPath = store.getProjectPath();
      if (!projectPath) return { ok: false, error: 'No project open' };
      const graph = store.getGraph();
      const sourceNode = graph.nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return { ok: false, error: 'Source node not found' };
      const forge = analysisEngine.getForgeEngine();
      try {
        const result = await forge.execute(blueprintName, {
          projectPath,
          adapterId: analysisEngine.getActiveAdapterId() ?? '',
          sourceNode,
          existingNodes: graph.nodes,
          existingEdges: graph.edges,
          params: params ?? {},
        });
        if (!result.success) {
          return { ok: false, error: result.errors?.join('; ') ?? 'Execution failed' };
        }
        const { newNodes, newEdges } = result.graphMutations;
        const mergedNodes = [...graph.nodes];
        const mergedEdges = [...graph.edges];
        for (const n of newNodes) {
          if (!mergedNodes.some((x) => x.id === n.id)) {
            mergedNodes.push({
              id: n.id,
              type: n.type as import('../shared/types/graph').GraphNodeType,
              filePath: n.filePath,
              label: n.label,
              metadata: n.metadata ?? {},
            });
          }
        }
        for (const e of newEdges) {
          if (!mergedEdges.some((x) => x.id === e.id)) {
            mergedEdges.push({
              id: e.id,
              from: e.from,
              to: e.to,
              type: (e.type as import('../shared/types/graph').GraphEdgeType) ?? 'arch_dependency',
            });
          }
        }
        store.setGraph({ nodes: mergedNodes, edges: mergedEdges });
        const entryFile = analysisEngine.getEntryFile?.();
        if (entryFile) {
          const res = activePlugin?.persistGraph
            ? activePlugin.persistGraph(entryFile, store.getGraph())
            : persistArchitectureToFile(entryFile, store.getGraph());
          if (!res.ok) {
            mainWindow?.webContents.send('project:open-error', res.error);
            return { ok: false, error: res.error };
          }
        }
        mainWindow?.webContents.send('graph:updated', {
          graph: store.getGraph(),
          issues: store.getAnalysisIssues(),
        });
        return {
          ok: true,
          result: {
            success: result.success,
            mutations: result.mutations,
            graphMutations: result.graphMutations,
            backupId: result.backupId,
          },
          pendingDiffs: [],
        };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
  );
  ipcMain.handle('forge:rollback', async (_e, backupId: string) => {
    const forge = analysisEngine.getForgeEngine();
    try {
      forge.rollback(backupId);
      await analysisEngine.refresh();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('forge:confirmPending', async (_e, backupId: string) => {
    const forge = analysisEngine.getForgeEngine();
    try {
      forge.confirmPending(backupId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('forge:confirmPendingFile', async (_e, backupId: string, filePath: string) => {
    const forge = analysisEngine.getForgeEngine();
    try {
      forge.confirmPendingFile(backupId, filePath);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('forge:discardPending', async (_e, backupId: string) => {
    const forge = analysisEngine.getForgeEngine();
    try {
      forge.confirmPending(backupId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle('forge:rollbackPendingFile', async (_e, backupId: string, filePath: string) => {
    const store = analysisEngine.getGraphStore();
    const projectPath = store.getProjectPath();
    if (!projectPath) return { ok: false, error: 'No project open' };
    const forge = analysisEngine.getForgeEngine();
    try {
      forge.rollbackFile(backupId, filePath, projectPath);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  // Plugins
  ipcMain.handle('plugins:list', () => {
    return getAllPlugins().map(p => p.getInfo());
  });

  ipcMain.handle('plugins:delete', async (_e, pluginId: string) => {
    const userDir = path.join(getUserPluginsDir(), pluginId);
    if (!fs.existsSync(userDir)) {
      return { ok: false, error: 'Plugin not found in user plugins folder.' };
    }
    const { dialog } = await import('electron');
    const choice = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Delete Plugin',
      message: `Delete plugin "${pluginId}"?`,
      detail: `This will permanently remove:\n${userDir}`,
      buttons: ['Delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    });
    if (choice.response !== 0) return { ok: false, error: 'Cancelled' };
    try {
      fs.rmSync(userDir, { recursive: true, force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('plugins:reveal', async (_e, pluginId: string) => {
    const { shell } = await import('electron');
    const userDir = path.join(getUserPluginsDir(), pluginId);
    if (fs.existsSync(userDir)) {
      shell.openPath(userDir);
      return { ok: true };
    }
    return { ok: false, error: 'Plugin folder not found.' };
  });

  ipcMain.handle('plugins:import', async () => {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Plugin — Select plugin folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'Cancelled' };

    const sourcePath = result.filePaths[0];

    // --- Validate ---
    const manifestPath = path.join(sourcePath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { ok: false, error: 'Invalid plugin: manifest.json not found.' };
    }

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'Invalid plugin: manifest.json is not valid JSON.' };
    }

    const pluginId = manifest['id'];
    const pluginName = manifest['name'];
    const parserFile = manifest['parser'];
    const accepts = manifest['accepts'];

    if (typeof pluginId !== 'string' || !pluginId.trim()) {
      return { ok: false, error: 'Invalid plugin: manifest.json must have an "id" field.' };
    }
    if (typeof pluginName !== 'string' || !pluginName.trim()) {
      return { ok: false, error: 'Invalid plugin: manifest.json must have a "name" field.' };
    }
    if (typeof parserFile !== 'string' || !parserFile.trim()) {
      return { ok: false, error: 'Invalid plugin: manifest.json must have a "parser" field.' };
    }
    if (accepts !== 'directory' && accepts !== 'file') {
      return { ok: false, error: 'Invalid plugin: manifest.json "accepts" must be "directory" or "file".' };
    }

    const parserPath = path.join(sourcePath, parserFile as string);
    if (!fs.existsSync(parserPath)) {
      return { ok: false, error: `Invalid plugin: parser file "${parserFile}" not found in plugin folder.` };
    }

    // --- Security warning ---
    const warnResult = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Install Plugin',
      message: `Install plugin "${pluginName}"?`,
      detail: 'This plugin has access to your file system. Only install plugins from sources you trust.',
      buttons: ['Cancel', 'Install'],
      defaultId: 0,
      cancelId: 0,
    });
    if (warnResult.response !== 1) return { ok: false, error: 'Installation cancelled.' };

    // --- Copy to ~/Documents/Arcforge/Plugins/[plugin-id]/ ---
    const destPath = path.join(getUserPluginsDir(), pluginId as string);
    try {
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true });
      }
      fs.cpSync(sourcePath, destPath, { recursive: true });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    // --- Copy SDK inside the imported plugin folder ---
    try {
      const sdkSrc = path.join(__dirname, '../plugins/arcforge-sdk.js');
      if (fs.existsSync(sdkSrc)) {
        fs.copyFileSync(sdkSrc, path.join(destPath, 'arcforge-sdk.js'));
      }
      const dtsSrc = path.join(__dirname, '../plugins/arcforge.d.ts');
      if (fs.existsSync(dtsSrc)) {
        fs.copyFileSync(dtsSrc, path.join(destPath, 'arcforge.d.ts'));
      }
    } catch {
      // Non-fatal
    }

    // --- Reload (invalidate require cache for the plugin) ---
    try {
      const newParserPath = path.join(destPath, parserFile as string);
      if (require.cache[newParserPath]) delete require.cache[newParserPath];
      const newManifestPath = path.join(destPath, 'manifest.json');
      if (require.cache[newManifestPath]) delete require.cache[newManifestPath];
      const nodesFile = manifest['nodes'];
      if (typeof nodesFile === 'string') {
        const newNodesPath = path.join(destPath, nodesFile);
        if (require.cache[newNodesPath]) delete require.cache[newNodesPath];
      }
    } catch {
      // Non-fatal
    }

    return { ok: true, pluginId: pluginId as string };
  });

  // Plugin Full Controller IPC handlers
  ipcMain.handle('plugin:reload', async () => {
    if (!activePlugin || !activeProjectPath) return { ok: false, error: 'No active plugin or project' };
    if (typeof activePlugin.reload !== 'function') {
      // Default: re-parse
      try {
        const result = await activePlugin.parseProject(activeProjectPath, {
          onProgress: (msg) => mainWindow?.webContents.send('analysis:status', { message: msg }),
        });
        const store = analysisEngine.getGraphStore();
        store.setGraph(result.graph);
        mainWindow?.webContents.send('graph:updated', { graph: result.graph, issues: result.errors ?? [] });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
    try {
      const result = await activePlugin.reload({ path: activeProjectPath });
      const store = analysisEngine.getGraphStore();
      store.setGraph(result.graph);
      mainWindow?.webContents.send('graph:updated', { graph: result.graph, issues: result.errors ?? [] });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('plugin:onNodeClick', async (_e, node: { id: string; type: string; filePath?: string; data?: Record<string, unknown> }) => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (!activePlugin.capabilities.openFileOnNodeClick) return { ok: false, skipped: true };

    if (typeof activePlugin.onNodeClick === 'function') {
      try {
        const result = await activePlugin.onNodeClick(node);
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }

    // Default: open node.filePath if present
    if (node.filePath) {
      return { ok: true, result: { filePath: node.filePath, language: undefined, scrollTo: undefined } };
    }
    return { ok: true, result: null };
  });

  ipcMain.handle('plugin:onNodeEdit', async (_e, node: { id: string; type: string; data?: Record<string, unknown> }, changes: Record<string, unknown>) => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (typeof activePlugin.onNodeEdit !== 'function') {
      // Default: update label in graph
      const store = analysisEngine.getGraphStore();
      const graph = store.getGraph();
      const label = typeof changes['name'] === 'string' ? changes['name'] : undefined;
      if (label) {
        const updatedNodes = graph.nodes.map(n => n.id === node.id ? { ...n, label } : n);
        store.setGraph({ nodes: updatedNodes, edges: graph.edges });
        mainWindow?.webContents.send('graph:updated', { graph: store.getGraph(), issues: store.getAnalysisIssues() });
      }
      return { ok: true, result: { id: node.id, label } };
    }
    try {
      const result = await activePlugin.onNodeEdit(node, changes);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('plugin:onNodeCreate', async (_e, type: string, position: { x: number; y: number }) => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (!activePlugin.capabilities.addNodes) return { ok: false, error: 'Plugin does not allow adding nodes' };

    if (typeof activePlugin.onNodeCreate === 'function') {
      try {
        const result = await activePlugin.onNodeCreate(type, position);
        const store = analysisEngine.getGraphStore();
        const graph = store.getGraph();
        store.setGraph({
          nodes: [...graph.nodes, {
            id: result.id,
            type: result.type as import('../shared/types/graph').GraphNodeType,
            filePath: '',
            label: result.label ?? result.id,
            metadata: result.data ?? {},
          }],
          edges: graph.edges,
        });
        mainWindow?.webContents.send('graph:updated', { graph: store.getGraph(), issues: store.getAnalysisIssues() });
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }

    // Default: create a basic node
    const nodeId = `${type}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const store = analysisEngine.getGraphStore();
    const graph = store.getGraph();
    store.setGraph({
      nodes: [...graph.nodes, {
        id: nodeId,
        type: type as import('../shared/types/graph').GraphNodeType,
        filePath: '',
        label: type,
        metadata: {},
      }],
      edges: graph.edges,
    });
    mainWindow?.webContents.send('graph:updated', { graph: store.getGraph(), issues: store.getAnalysisIssues() });
    return { ok: true, result: { id: nodeId, type, position, label: type } };
  });

  ipcMain.handle('plugin:onNodeDelete', async (_e, node: { id: string; type: string }) => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (typeof activePlugin.onNodeDelete === 'function') {
      try {
        const result = await activePlugin.onNodeDelete(node);
        if (result.success === false) return { ok: false, error: result.error };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
    return { ok: true };
  });

  ipcMain.handle('plugin:onEdgeCreate', async (_e, source: { id: string; type: string }, target: { id: string; type: string }, edgeType?: string) => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (typeof activePlugin.onEdgeCreate === 'function') {
      try {
        const result = await activePlugin.onEdgeCreate(source, target, edgeType);
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
    // Default edge result
    return {
      ok: true,
      result: {
        id: `edge:${source.id}:${target.id}:${Date.now()}`,
        source: source.id,
        target: target.id,
        type: edgeType ?? 'calls',
      },
    };
  });

  ipcMain.handle('plugin:onSave', async () => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (!activePlugin.capabilities.saveGraph) return { ok: false, error: 'Plugin does not support saving' };
    const store = analysisEngine.getGraphStore();
    const graph = store.getGraph();
    if (typeof activePlugin.onSave === 'function') {
      try {
        const result = await activePlugin.onSave(graph);
        return { ok: result.success, error: result.error };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
    // Default: use persistGraph if available
    const entryFile = analysisEngine.getEntryFile?.();
    if (entryFile && activePlugin.persistGraph) {
      const res = activePlugin.persistGraph(entryFile, graph);
      return res;
    }
    return { ok: true };
  });

  ipcMain.handle('plugin:onExport', async (_e, options?: { language?: string; framework?: string; outputType?: string }) => {
    if (!activePlugin) return { ok: false, error: 'No active plugin' };
    if (!activePlugin.capabilities.exportPrompt) return { ok: false, error: 'Plugin does not support export' };
    const store = analysisEngine.getGraphStore();
    const graph = store.getGraph();
    if (typeof activePlugin.onExport === 'function') {
      try {
        const prompt = await activePlugin.onExport(graph, options);
        return { ok: true, prompt };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
    return { ok: false, error: 'Plugin does not implement onExport' };
  });

  ipcMain.handle('plugins:getCapabilities', () => {
    if (!activePlugin) return null;
    return activePlugin.capabilities;
  });

  ipcMain.handle('plugins:create', async (_e, opts: { id: string; name: string; author: string; accepts: 'directory' | 'file' }) => {
    const { dialog } = await import('electron');

    // Pick destination folder
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Choose folder where to create the plugin',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, error: 'Cancelled' };

    const destDir = path.join(result.filePaths[0], opts.id);

    if (fs.existsSync(destDir)) {
      return { ok: false, error: `Folder "${opts.id}" already exists in the selected directory.` };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { generatePluginTemplate } = require('../../scripts/pluginTemplate') as typeof import('../../scripts/pluginTemplate');
      const res = generatePluginTemplate(destDir, opts);

      // Copy SDK and type defs inside the plugin folder — plugin is self-contained
      const sdkSrc = path.join(__dirname, '../plugins/arcforge-sdk.js');
      if (fs.existsSync(sdkSrc)) {
        fs.copyFileSync(sdkSrc, path.join(destDir, 'arcforge-sdk.js'));
      }
      const dtsSrc = path.join(__dirname, '../plugins/arcforge.d.ts');
      if (fs.existsSync(dtsSrc)) {
        fs.copyFileSync(dtsSrc, path.join(destDir, 'arcforge.d.ts'));
      }

      return { ok: true, path: res.path };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
