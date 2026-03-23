/**
 * Custom title bar: app icon, menu (File, Edit, View, Help), window controls.
 * Replaces the native OS menu; drag region for moving the window.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useViewStore } from '../store/viewStore';
import { useGraphStore } from '../store/graphStore';
import { AppIcon } from './AppIcon';
import { runEditorAction, runEditorKey } from '../editorRegistry';

declare const window: Window & { arcforge?: import('../../../shared/types').ArcforgeAPI };

const TITLE_BAR_HEIGHT = 32;

/** Run via editor key (same path as hotkeys); if no editor, fallback to execCommand. */
function runEditKey(code: string, execCommand?: string) {
  if (runEditorKey(code, true, false)) return;
  if (execCommand) document.execCommand(execCommand);
}

/** App icon before menu — theme-adaptive (currentColor). */
function TitleBarAppIcon() {
  return (
    <AppIcon
      size={20}
      className="arcforge-titlebar-icon"
    />
  );
}

/** Window control buttons (minimize, maximize, close) */
function WindowControls() {
  const handleMinimize = useCallback(() => window.arcforge?.window.minimize(), []);
  const handleMaximize = useCallback(() => window.arcforge?.window.maximize(), []);
  const handleClose = useCallback(() => window.arcforge?.window.close(), []);

  return (
    <div className="arcforge-titlebar-window-controls">
      <button
        type="button"
        className="arcforge-titlebar-win-btn arcforge-titlebar-win-minimize"
        onClick={handleMinimize}
        aria-label="Minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="1" y1="5" x2="9" y2="5" />
        </svg>
      </button>
      <button
        type="button"
        className="arcforge-titlebar-win-btn arcforge-titlebar-win-maximize"
        onClick={handleMaximize}
        aria-label="Maximize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" />
        </svg>
      </button>
      <button
        type="button"
        className="arcforge-titlebar-win-btn arcforge-titlebar-win-close"
        onClick={handleClose}
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M1 1l8 8M9 1L1 9" />
        </svg>
      </button>
    </div>
  );
}

type MenuId = 'file' | 'edit' | 'view' | 'settings' | 'help' | null;

type ThemeMode = 'dark' | 'light';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage?.getItem('arcforge.theme');
  if (stored === 'dark' || stored === 'light') return stored;
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  return prefersLight ? 'light' : 'dark';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = mode;
  // Adjust color-scheme for scrollbars / native UI
  root.style.colorScheme = mode === 'light' ? 'light' : 'dark';
  window.localStorage?.setItem('arcforge.theme', mode);
}

interface TitleBarProps {
  onOpenProjectModal?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenProjectModal }) => {
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const barRef = useRef<HTMLDivElement>(null);
  const { explorer, minimapVisible, controlsVisible, editorLayoutMode } = useViewStore();

  useEffect(() => {
    const onGlobalClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    window.addEventListener('click', onGlobalClick);
    return () => window.removeEventListener('click', onGlobalClick);
  }, []);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  const toggleMenu = useCallback((id: MenuId) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  }, []);

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  const handleOpenProject = useCallback(() => {
    closeMenu();
    onOpenProjectModal?.();
  }, [closeMenu, onOpenProjectModal]);

  const onImportPlugin = useCallback(async () => {
    closeMenu();
    await window.arcforge?.plugins?.importPlugin?.();
  }, [closeMenu]);

  const onCreateArchitecture = useCallback(async () => {
    closeMenu();
    await window.arcforge?.project.createArchitecture?.();
  }, [closeMenu]);

  const onOpenArchitecture = useCallback(async () => {
    closeMenu();
    await window.arcforge?.project.openArchitecture?.();
  }, [closeMenu]);

  const onCloseProject = useCallback(() => {
    closeMenu();
    window.arcforge?.project.close();
  }, [closeMenu]);

  const projectPath = useGraphStore((s) => s.projectPath);
  const onRebuildLayoutConfig = useCallback(() => {
    closeMenu();
    window.dispatchEvent(new CustomEvent('arcforge:requestRebuildLayoutConfig'));
  }, [closeMenu]);

  const onQuit = useCallback(() => {
    closeMenu();
    window.arcforge?.window.close();
  }, [closeMenu]);

  const setView = useCallback((patch: Partial<{ explorer: boolean; sourceControl: boolean; tasks: boolean; testResults: boolean; issues: boolean; minimapVisible: boolean; controlsVisible: boolean; editorLayoutMode: 'tab' | 'split' }>) => {
    const s = useViewStore.getState();
    const next = { ...s, ...patch };
    s.setState(next);
    window.arcforge?.view.setState(patch);
  }, []);

  const onAboutArcforge = useCallback(() => {
    closeMenu();
    window.arcforge?.external.open('https://github.com/ysz7/Arcforge');
  }, [closeMenu]);

  return (
    <header
      ref={barRef}
      className="arcforge-titlebar"
      style={{ height: TITLE_BAR_HEIGHT }}
      data-drag-region
    >
      <div className="arcforge-titlebar-left">
        <span className="arcforge-titlebar-icon-wrap" data-drag-region>
          <TitleBarAppIcon />
        </span>
        <nav className="arcforge-titlebar-menu" data-no-drag>
          <div className="arcforge-titlebar-menu-item">
            <button
              type="button"
              className="arcforge-titlebar-menu-btn"
              onClick={() => toggleMenu('file')}
              aria-expanded={openMenu === 'file'}
              aria-haspopup="true"
            >
              File
            </button>
            {openMenu === 'file' && (
              <div className="arcforge-titlebar-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={handleOpenProject}>
                Open Project…
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={onCreateArchitecture}>
                Create new ArcSpec…
              </button>
              <button type="button" role="menuitem" onClick={onOpenArchitecture}>
                Open ArcSpec…
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={onImportPlugin}>
                Import Plugin…
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={onCloseProject}>
                Close
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onRebuildLayoutConfig}
                disabled={!projectPath}
              >
                Rebuild layout config
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={onQuit}>
                Quit
              </button>
            </div>
            )}
          </div>

          <div className="arcforge-titlebar-menu-item">
            <button
              type="button"
              className="arcforge-titlebar-menu-btn"
              onClick={() => toggleMenu('edit')}
              aria-expanded={openMenu === 'edit'}
              aria-haspopup="true"
            >
              Edit
            </button>
            {openMenu === 'edit' && (
              <div className="arcforge-titlebar-dropdown" role="menu">
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditKey('KeyZ', 'undo'); }}>
                  Undo <span className="arcforge-titlebar-accel">Ctrl+Z</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditKey('KeyY', 'redo'); }}>
                  Redo <span className="arcforge-titlebar-accel">Ctrl+Y</span>
                </button>
                <hr />
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditKey('KeyX', 'cut'); }}>
                  Cut <span className="arcforge-titlebar-accel">Ctrl+X</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditKey('KeyC', 'copy'); }}>
                  Copy <span className="arcforge-titlebar-accel">Ctrl+C</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditKey('KeyV', 'paste'); }}>
                  Paste <span className="arcforge-titlebar-accel">Ctrl+V</span>
                </button>
                <hr />
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditorAction('actions.find'); }}>
                  Find <span className="arcforge-titlebar-accel">Ctrl+F</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditorAction('editor.action.startFindReplaceAction'); }}>
                  Replace <span className="arcforge-titlebar-accel">Ctrl+H</span>
                </button>
                <hr />
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditorAction('actions.find'); }}>
                  Find in Files <span className="arcforge-titlebar-accel">Ctrl+Shift+F</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { closeMenu(); runEditorAction('editor.action.startFindReplaceAction'); }}>
                  Replace in Files <span className="arcforge-titlebar-accel">Ctrl+Shift+H</span>
                </button>
              </div>
            )}
          </div>

          <div className="arcforge-titlebar-menu-item">
            <button
              type="button"
              className="arcforge-titlebar-menu-btn"
              onClick={() => toggleMenu('view')}
              aria-expanded={openMenu === 'view'}
              aria-haspopup="true"
            >
              View
            </button>
            {openMenu === 'view' && (
              <div className="arcforge-titlebar-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView({ explorer: !explorer })}
                  aria-checked={explorer}
                >
                  {explorer ? '✓ ' : ''}Explorer
                </button>
                <hr />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView({ minimapVisible: !minimapVisible })}
                  aria-checked={minimapVisible}
                >
                  {minimapVisible ? '✓ ' : ''}Minimap
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setView({ controlsVisible: !controlsVisible })}
                  aria-checked={controlsVisible}
                >
                  {controlsVisible ? '✓ ' : ''}Graph controls
                </button>
              </div>
            )}
          </div>

          <div className="arcforge-titlebar-menu-item">
            <button
              type="button"
              className="arcforge-titlebar-menu-btn"
              onClick={() => toggleMenu('settings')}
              aria-expanded={openMenu === 'settings'}
              aria-haspopup="true"
            >
              Settings
            </button>
            {openMenu === 'settings' && (
              <div className="arcforge-titlebar-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={themeMode === 'dark'}
                  onClick={() => {
                    closeMenu();
                    setThemeMode('dark');
                  }}
                >
                  {themeMode === 'dark' ? '● ' : '○ '}Dark theme
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={themeMode === 'light'}
                  onClick={() => {
                    closeMenu();
                    setThemeMode('light');
                  }}
                >
                  {themeMode === 'light' ? '● ' : '○ '}Light theme
                </button>
              </div>
            )}
          </div>

          <div className="arcforge-titlebar-menu-item">
            <button
              type="button"
              className="arcforge-titlebar-menu-btn"
              onClick={() => toggleMenu('help')}
            aria-expanded={openMenu === 'help'}
            aria-haspopup="true"
          >
            Help
          </button>
          {openMenu === 'help' && (
            <div className="arcforge-titlebar-dropdown" role="menu">
              <button type="button" role="menuitem" onClick={onAboutArcforge}>
                About Arcforge
              </button>
            </div>
            )}
          </div>
        </nav>
      </div>

      <div className="arcforge-titlebar-right" data-no-drag>
        <WindowControls />
      </div>
    </header>
  );
};
