/**
 * Root UI: ScrollArea + Collapsible (sidebar), Tabs (content).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Separator from '@radix-ui/react-separator';
import { useGraphStore } from './store/graphStore';
import { useViewStore } from './store/viewStore';
import { loadArcforgeConfig, saveArcforgeConfig } from './utils/arcforgeConfig';
import { GraphView } from './components/GraphView';
import { FileExplorer } from './components/FileExplorer';
import { EditorPanel } from './components/EditorPanel';
import { NotificationBar } from './components/NotificationBar';
import { CommandPalette } from './components/CommandPalette';
import { TitleBar } from './components/TitleBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ConfirmModal } from './components/ConfirmModal';
import { OpenProjectModal } from './components/OpenProjectModal';
import { registerCommand } from './store/commandStore';
import { useNotificationStore } from './store/notificationStore';
import { getEditorForPath } from './editorRegistry';

declare const window: Window & { arcforge?: import('./global').ArcforgeAPI };

const SIDEBAR_WIDTH = 240;

export const App: React.FC = () => {
  const {
    projectPath,
    entryFileRelative,
    graph,
    graphNodePositions,
    graphViewport,
    setProject,
    setGraph,
    setAnalysisIssues,
    openFilePaths,
    activeTab,
    fileContents,
    fileScrollToLine,
    openFile,
    closeFile,
    setActiveTab,
    setFileScrollPosition,
    fileDirty,
    setFileDirty,
    moveFileTab,
    setActivePlugin,
    setPositionsReady,
  } = useGraphStore();

  // Debounced save of node positions and viewport to config
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!projectPath) return;
    const hasData = (graphNodePositions && Object.keys(graphNodePositions).length > 0) || graphViewport;
    if (!hasData) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const store = useGraphStore.getState();
      saveArcforgeConfig(
        projectPath,
        {
          graphNodePositions: graphNodePositions ?? undefined,
          graphViewport: graphViewport ?? undefined,
        },
        store.adapterId,
        store.entryFileRelative
      ).catch(() => {});
    }, 500);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [projectPath, graphNodePositions, graphViewport]);
  const { explorer, sourceControl, tasks, testResults, issues } = useViewStore();
  const hasSidebarPanels = explorer || sourceControl || tasks || testResults || issues;

  const handleForgeDone = useCallback(async () => {
    useGraphStore.getState().setExplorerRefreshTrigger();
    if (!projectPath || !window.arcforge) return;
    for (const path of openFilePaths) {
      if (fileDirty[path]) continue;
      const res = await window.arcforge.fs.readFile(projectPath, path);
      if (res.ok && res.content !== null) {
        openFile(path, res.content, { activate: false });
      }
    }
  }, [projectPath, openFilePaths, fileDirty, openFile]);
  const handleRebuildLayoutConfig = useCallback(async () => {
    const store = useGraphStore.getState();
    if (!store.projectPath) return;
    store.setGraphNodePositions(null);
    store.setGraphViewport(null);
    window.dispatchEvent(new CustomEvent('arcforge:resetLayoutRef'));
    await saveArcforgeConfig(
      store.projectPath,
      { graphNodePositions: undefined, graphViewport: undefined },
      store.adapterId,
      store.entryFileRelative
    ).catch(() => {});
    useNotificationStore.getState().add('success', 'Layout reset to default and saved to .arcforge');
  }, []);

  const persistCurrentProjectConfig = useCallback(async (): Promise<boolean> => {
    const store = useGraphStore.getState();
    if (!store.projectPath || (!store.graphNodePositions && !store.graphViewport)) return false;

    const res = await saveArcforgeConfig(
      store.projectPath,
      {
        graphNodePositions: store.graphNodePositions ?? undefined,
        graphViewport: store.graphViewport ?? undefined,
      },
      store.adapterId,
      store.entryFileRelative
    ).catch(() => ({ ok: false }));
    return res?.ok === true;
  }, []);


  useEffect(() => {
    const api = window.arcforge?.view;
    if (!api) return;
    api.getState().then((s) => useViewStore.getState().setState(s));
    return api.onStateChanged((s) => useViewStore.getState().setState(s));
  }, []);

  useEffect(() => {
    const api = window.arcforge;
    if (!api) return;
    api.graph.onUpdated((payload: { graph: import('./global').ArcforgeGraph; issues?: Array<{ filePath?: string; line?: number; message: string }> }) => {
      setGraph(payload.graph, { fromForge: payload.fromForge });
      setAnalysisIssues(payload.issues ?? []);
    });
    api.graph.subscribe();
  }, [setGraph, setAnalysisIssues]);

  useEffect(() => {
    const api = window.arcforge;
    if (!api?.analysis?.onStatus) return;
    return api.analysis.onStatus((status) => {
      useGraphStore.getState().setAnalysisStatus(status);
    });
  }, []);

  useEffect(() => {
    const api = window.arcforge;
    if (!api?.project) return;
    const unOpened = api.project.onOpened(async (payload) => {
      try {
        const prev = useGraphStore.getState();
        if (prev.projectPath && prev.projectPath !== payload.projectPath) {
          await saveArcforgeConfig(
            prev.projectPath,
            {
              graphNodePositions: prev.graphNodePositions ?? undefined,
              graphViewport: prev.graphViewport ?? undefined,
            },
            prev.adapterId,
            prev.entryFileRelative
          ).catch(() => {});
        }
        setProject(payload.projectPath, payload.adapterId, payload.entryFile ?? null);
        if (payload.pluginInfo) {
          setActivePlugin(payload.pluginInfo);
        }
        // Clear stale positions from previous project before loading new config.
        useGraphStore.getState().setGraphNodePositions(null);
        useGraphStore.getState().setGraphViewport(null);
        setGraph({ nodes: [], edges: [] });
        setAnalysisIssues([]);
        useGraphStore.getState().setAnalysisStatus({ message: 'Indexing project…', phase: 'discover' });
        const [res, config] = await Promise.all([
          api!.graph.get(),
          loadArcforgeConfig(payload.projectPath, payload.adapterId, payload.entryFile ?? undefined),
        ]);
        const g = res?.graph ?? { nodes: [], edges: [] };
        const iss = res?.issues ?? [];
        if (config) {
          const store = useGraphStore.getState();
          if (config.graphNodePositions && Object.keys(config.graphNodePositions).length > 0) {
            store.setGraphNodePositions(config.graphNodePositions);
          }
          if (config.graphViewport) {
            store.setGraphViewport(config.graphViewport);
          }
        }
        // Signal that positions are resolved (loaded or confirmed absent) before setting graph,
        // so the two-pass layout in GraphView won't fire prematurely with null positions.
        useGraphStore.getState().setPositionsReady(true);
        setGraph(g);
        setAnalysisIssues(iss);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useNotificationStore.getState().add('error', `Failed to open project: ${msg}`);
      }
    });
    const unClosed = api.project.onClosed(() => {
      void persistCurrentProjectConfig();
      useGraphStore.getState().reset();
    });
    const unError = api.project.onOpenError((error) =>
      useNotificationStore.getState().add('error', error)
    );
    return () => {
      unOpened();
      unClosed();
      unError();
    };
  }, [setProject, setGraph, setAnalysisIssues, setPositionsReady, persistCurrentProjectConfig]);

  const [closingSyncVisible, setClosingSyncVisible] = useState(false);
  const closeAbortedRef = useRef(false);

  // Save config when window is about to close (before renderer is destroyed).
  useEffect(() => {
    const api = window.arcforge;
    if (!api?.window?.onPrepareClose) return;
    const unsub = api.window.onPrepareClose(async () => {
      closeAbortedRef.current = false;
      setClosingSyncVisible(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (closeAbortedRef.current) return;
      window.dispatchEvent(new CustomEvent('arcforge:flushViewport'));
      await persistCurrentProjectConfig();
      if (closeAbortedRef.current) return;
      api.window.readyToClose();
    });
    return unsub;
  }, [persistCurrentProjectConfig]);

  const handleCancelClose = useCallback(() => {
    closeAbortedRef.current = true;
    setClosingSyncVisible(false);
    window.arcforge?.window.cancelClose();
  }, []);

  useEffect(() => {
    const unregClose = registerCommand({
      id: 'project.close',
      label: 'Close project',
      run: () => window.arcforge?.project.close(),
    });
    return () => {
      unregClose();
    };
  }, []);

  const handleOpenFile = useCallback(
    async (relativePath: string, options?: { scrollToLine?: number }) => {
      if (!projectPath || !window.arcforge) return;
      const res = await window.arcforge.fs.readFile(projectPath, relativePath);
      if (res.ok && res.content !== null) openFile(relativePath, res.content, options);
    },
    [projectPath, openFile]
  );

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [openProjectModalOpen, setOpenProjectModalOpen] = useState(false);
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [rebuildLayoutModalOpen, setRebuildLayoutModalOpen] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<{
    hasUpdate: boolean;
    latestVersion: string | null;
    downloadUrl: string | null;
    changelogUrl: string | null;
  } | null>(null);

  const handleSaveActiveFile = useCallback(async () => {
    if (!projectPath || !window.arcforge) return;
    if (!activeTab || activeTab === 'graph') return;
    const content = fileContents[activeTab];
    if (typeof content !== 'string') return;
    const res = await window.arcforge.fs.writeFile(projectPath, activeTab, content);
    if (!res.ok) {
      const msg = res.error ?? 'Failed to save file';
      useNotificationStore.getState().add('error', msg);
    } else {
      useNotificationStore.getState().add('info', `Saved ${activeTab}`);
      setFileDirty(activeTab, false);
    }
  }, [projectPath, activeTab, fileContents, setFileDirty]);

  const requestCloseTab = useCallback(
    (path: string) => {
      const dirty = !!fileDirty[path];
      if (!dirty) {
        closeFile(path);
      } else {
        setPendingClosePath(path);
      }
    },
    [fileDirty, closeFile]
  );

  const handleCloseActiveTab = useCallback(() => {
    if (!activeTab || activeTab === 'graph') return;
    requestCloseTab(activeTab);
  }, [activeTab, requestCloseTab]);

  // Check for updates once per app start.
  useEffect(() => {
    const api = window.arcforge;
    if (!api?.updates) return;
    api.updates
      .getStatus()
      .then((status) => {
        if (status.hasUpdate) {
          setUpdateBanner({
            hasUpdate: true,
            latestVersion: status.latestVersion,
            downloadUrl: status.downloadUrl,
            changelogUrl: status.changelogUrl,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const openPalette = () => setCommandPaletteOpen(true);
    window.addEventListener('arcforge:open-command-palette', openPalette);
    return () => window.removeEventListener('arcforge:open-command-palette', openPalette);
  }, []);

  useEffect(() => {
    const openProject = () => setOpenProjectModalOpen(true);
    window.addEventListener('arcforge:open-project-modal', openProject);
    return () => window.removeEventListener('arcforge:open-project-modal', openProject);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Command palette
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
        return;
      }
      // Save (Ctrl+S)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        void handleSaveActiveFile();
        return;
      }
      // Close tab (Ctrl+W)
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyW') {
        e.preventDefault();
        handleCloseActiveTab();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSaveActiveFile, handleCloseActiveTab]);

  useEffect(() => {
    const handler = () => setRebuildLayoutModalOpen(true);
    window.addEventListener('arcforge:requestRebuildLayoutConfig', handler);
    return () => window.removeEventListener('arcforge:requestRebuildLayoutConfig', handler);
  }, []);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      requestCloseTab(path);
    },
    [requestCloseTab]
  );

  const handleTabDragStart = useCallback((e: React.DragEvent, filePath: string) => {
    e.dataTransfer.setData('text/arcforge-tab', filePath);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleTabDrop = useCallback(
    (e: React.DragEvent, targetPath: string) => {
      e.preventDefault();
      const sourcePath = e.dataTransfer.getData('text/arcforge-tab');
      if (sourcePath && sourcePath !== targetPath) moveFileTab(sourcePath, targetPath);
    },
    [moveFileTab]
  );

  const tabsRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabsRowRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TitleBar onOpenProjectModal={() => setOpenProjectModalOpen(true)} />
      {!projectPath ? (
        <WelcomeScreen />
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {hasSidebarPanels && (
            <aside
              className="arcforge-sidebar"
              style={{ width: SIDEBAR_WIDTH, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
              {explorer && (
                <ScrollArea.Root style={{ flex: 1, overflow: 'hidden' }}>
                  <ScrollArea.Viewport style={{ width: '100%', height: '100%' }}>
                    <FileExplorer projectPath={projectPath} onOpenFile={handleOpenFile} />
                  </ScrollArea.Viewport>
                  <ScrollArea.Scrollbar orientation="vertical">
                    <ScrollArea.Thumb />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              )}
            </aside>
          )}
          {hasSidebarPanels && <Separator.Root orientation="vertical" />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <Tabs.Root
              value={activeTab}
              onValueChange={(v) => {
                const nextTab = v as 'graph' | string;
                if (activeTab !== nextTab && activeTab !== 'graph' && typeof activeTab === 'string') {
                  const editor = getEditorForPath(activeTab);
                  if (editor) {
                    setFileScrollPosition(activeTab, editor.getScrollTop(), editor.getScrollLeft());
                  }
                }
                setActiveTab(nextTab);
              }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div ref={tabsRowRef} className="arcforge-tabs-row">
                <Tabs.List className="arcforge-tabs-list">
                  <Tabs.Trigger value="graph" className="arcforge-tab arcforge-tab-graph">
                    <span className="arcforge-tab-label">Graph</span>
                  </Tabs.Trigger>
                  {openFilePaths.map((filePath) => {
                    const isDirty = !!fileDirty[filePath];
                    const label = filePath.split(/[\\/]/).pop();
                    return (
                      <Tabs.Trigger
                        key={filePath}
                        value={filePath}
                        className={`arcforge-tab arcforge-tab-file${isDirty ? ' arcforge-tab-diff' : ''}`}
                        draggable
                        onDragStart={(e) => handleTabDragStart(e, filePath)}
                        onDragOver={handleTabDragOver}
                        onDrop={(e) => handleTabDrop(e, filePath)}
                      >
                        <span className="arcforge-tab-label" title={filePath}>
                          {isDirty && <span className="arcforge-tab-diff-dot" />}
                          {label}
                        </span>
                        <button
                          type="button"
                          className="arcforge-tab-close"
                          onClick={(e) => handleCloseTab(e, filePath)}
                          aria-label="Close tab"
                        >
                          ×
                        </button>
                      </Tabs.Trigger>
                    );
                  })}
                </Tabs.List>
              </div>
              <Tabs.Content value="graph" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {graph.nodes.length > 0 ? (
                  <div style={{ height: '100%' }}>
                    <GraphView
                      key={projectPath}
                      graph={graph}
                      onOpenFile={handleOpenFile}
                      onForgeDone={handleForgeDone}
                    />
                  </div>
                ) : (
                  <div className="arcforge-empty-state" role="status">
                    {projectPath
                      ? 'No graph nodes found. Open the project root to analyze the backend.'
                      : 'Open a project folder to see the architecture graph.'}
                  </div>
                )}
              </Tabs.Content>
              {openFilePaths.map((filePath) => (
                <Tabs.Content key={filePath} value={filePath} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {fileContents[filePath] !== undefined && (
                    <EditorPanel
                      relativePath={filePath}
                      content={fileContents[filePath]}
                      scrollToLine={fileScrollToLine[filePath]}
                      isActive={activeTab === filePath}
                      onContentChange={(value) => useGraphStore.getState().setFileContent(filePath, value)}
                    />
                  )}
                </Tabs.Content>
              ))}
            </Tabs.Root>
          </div>
        </div>
      </div>
      )}
      {updateBanner?.hasUpdate && (
        <div className="arcforge-update-banner">
          <span className="arcforge-update-banner-text">
            New version {updateBanner.latestVersion ?? ''} of Arcforge is available.
          </span>
          <button
            type="button"
            onClick={() => {
              setUpdateBanner(null);
            }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              const url =
                updateBanner.changelogUrl ??
                updateBanner.downloadUrl ??
                'https://github.com/ysz7/Arcforge/releases/latest';
              window.arcforge?.external.open(url);
              setUpdateBanner(null);
            }}
          >
            Open GitHub
          </button>
          <button
            type="button"
            className="arcforge-notification-close"
            aria-label="Dismiss update notification"
            onClick={() => {
              setUpdateBanner(null);
            }}
          >
            ✕
          </button>
        </div>
      )}
      <NotificationBar />
      {closingSyncVisible && (
        <div className="arcforge-closing-sync-overlay">
          <div className="arcforge-closing-sync-modal">
            <p className="arcforge-closing-sync-message">Syncing files before closing…</p>
            <p className="arcforge-closing-sync-hint">The app will close after sync completes.</p>
            <button
              type="button"
              className="arcforge-closing-sync-cancel"
              onClick={handleCancelClose}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {pendingClosePath && (
        <ConfirmModal
          title="Unsaved changes"
          message={`You have unsaved changes in ${pendingClosePath}. Discard them and close the tab?`}
          confirmLabel="Discard"
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            closeFile(pendingClosePath);
            setPendingClosePath(null);
          }}
          onCancel={() => setPendingClosePath(null)}
        />
      )}
      {rebuildLayoutModalOpen && (
        <ConfirmModal
          title="Rebuild layout config"
          message="This will reset the graph layout to default (as on first open) and save the new layout to .arcforge. Continue?"
          confirmLabel="Rebuild"
          cancelLabel="Cancel"
          onConfirm={async () => {
            setRebuildLayoutModalOpen(false);
            await handleRebuildLayoutConfig();
          }}
          onCancel={() => setRebuildLayoutModalOpen(false)}
        />
      )}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      {openProjectModalOpen && (
        <OpenProjectModal onClose={() => setOpenProjectModalOpen(false)} />
      )}
    </div>
  );
};
