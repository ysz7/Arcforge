/**
 * Open Project modal — multi-step: choose plugin, then open or create.
 * Footer: Import Plugin | New Plugin (developer tool).
 * Community plugins support right-click context menu: Delete / Open Folder.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PluginInfo } from '../../../shared/types/plugin';

declare const window: Window & { arcforge?: import('../global').ArcforgeAPI };

interface OpenProjectModalProps {
  onClose: () => void;
}

type Step = 'choose-plugin' | 'choose-action' | 'new-plugin';

interface ContextMenu {
  plugin: PluginInfo;
  x: number;
  y: number;
}

const EMPTY_NEW = { id: '', name: '', author: '', accepts: 'directory' as 'directory' | 'file' };

export const OpenProjectModal: React.FC<OpenProjectModalProps> = ({ onClose }) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [step, setStep] = useState<Step>('choose-plugin');
  const [working, setWorking] = useState(false);
  const [newPlugin, setNewPlugin] = useState(EMPTY_NEW);
  const [newPluginError, setNewPluginError] = useState<string | null>(null);
  const [newPluginSuccess, setNewPluginSuccess] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = window.arcforge;
    if (!api?.plugins) { setLoading(false); return; }
    api.plugins.list().then((list) => {
      setPlugins(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const handlePluginClick = useCallback((plugin: PluginInfo) => {
    setSelectedPlugin(plugin);
    setStep('choose-action');
  }, []);

  const handlePluginContextMenu = useCallback((e: React.MouseEvent, plugin: PluginInfo) => {
    if (plugin.source !== 'user') return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ plugin, x: e.clientX, y: e.clientY });
  }, []);

  const handleContextReveal = useCallback(async () => {
    if (!contextMenu || !window.arcforge) return;
    setContextMenu(null);
    await window.arcforge.plugins.revealPlugin(contextMenu.plugin.id);
  }, [contextMenu]);

  const handleContextDelete = useCallback(async () => {
    if (!contextMenu || !window.arcforge) return;
    const plugin = contextMenu.plugin;
    setContextMenu(null);
    setWorking(true);
    try {
      const res = await window.arcforge.plugins.deletePlugin(plugin.id);
      if (res?.ok) {
        const list = await window.arcforge.plugins.list();
        setPlugins(list);
      }
    } finally {
      setWorking(false);
    }
  }, [contextMenu]);

  const handleBack = useCallback(() => {
    setSelectedPlugin(null);
    setNewPlugin(EMPTY_NEW);
    setNewPluginError(null);
    setNewPluginSuccess(null);
    setStep('choose-plugin');
  }, []);

  const handleOpen = useCallback(async () => {
    if (!selectedPlugin || !window.arcforge) return;
    setWorking(true);
    try {
      await window.arcforge.project.openWithPlugin(selectedPlugin.id);
      onClose();
    } finally {
      setWorking(false);
    }
  }, [selectedPlugin, onClose]);

  const handleCreate = useCallback(async () => {
    if (!selectedPlugin || !window.arcforge) return;
    setWorking(true);
    try {
      await window.arcforge.project.createWithPlugin(selectedPlugin.id);
      onClose();
    } finally {
      setWorking(false);
    }
  }, [selectedPlugin, onClose]);

  const handleImportPlugin = useCallback(async () => {
    if (!window.arcforge) return;
    setWorking(true);
    try {
      const res = await window.arcforge.plugins.importPlugin();
      if (res?.ok) {
        const list = await window.arcforge.plugins.list();
        setPlugins(list);
      }
    } finally {
      setWorking(false);
    }
  }, []);

  const handleNewPluginSubmit = useCallback(async () => {
    if (!window.arcforge?.plugins?.createPlugin) return;
    setNewPluginError(null);
    setNewPluginSuccess(null);
    const id = newPlugin.id.trim().toLowerCase().replace(/\s+/g, '-');
    if (!id || !newPlugin.name.trim()) {
      setNewPluginError('ID and Name are required.');
      return;
    }
    setWorking(true);
    try {
      const res = await window.arcforge.plugins.createPlugin({ ...newPlugin, id });
      if (res?.ok) {
        setNewPluginSuccess(`Plugin created at: ${res.path}`);
      } else {
        setNewPluginError(res?.error ?? 'Failed to create plugin.');
      }
    } finally {
      setWorking(false);
    }
  }, [newPlugin]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const titleMap: Record<Step, string> = {
    'choose-plugin': 'Open Project',
    'choose-action': `Open with ${selectedPlugin?.name ?? ''}`,
    'new-plugin': 'New Plugin',
  };

  return (
    <div className="arcforge-modal-overlay" onClick={handleOverlayClick}>
      <div className="arcforge-modal" style={{ width: 460 }}>

        {/* Header */}
        <div className="arcforge-modal-header">
          {step !== 'choose-plugin' && (
            <button type="button" className="arcforge-modal-back-btn" onClick={handleBack} aria-label="Back" style={{ marginRight: 8 }}>
              ←
            </button>
          )}
          <span className="arcforge-modal-title">{titleMap[step]}</span>
          <button type="button" className="arcforge-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="arcforge-modal-divider-spacer" />

        {/* Step: choose-plugin */}
        {step === 'choose-plugin' && (
          <>
            {loading ? (
              <div style={{ padding: '24px 20px', color: '#6b6b7a', fontSize: 13, textAlign: 'center' }}>Loading plugins…</div>
            ) : plugins.length === 0 ? (
              <div style={{ padding: '24px 20px', color: '#6b6b7a', fontSize: 13, textAlign: 'center' }}>No plugins available.</div>
            ) : (
              <div className="open-project-plugin-grid">
                {plugins.map((plugin) => (
                  <button
                    key={plugin.id}
                    type="button"
                    className="open-project-plugin-card"
                    onClick={() => handlePluginClick(plugin)}
                    onContextMenu={(e) => handlePluginContextMenu(e, plugin)}
                  >
                    <div className="open-project-plugin-icon">{plugin.icon}</div>
                    <div className="open-project-plugin-info">
                      <div className="open-project-plugin-name">{plugin.name}</div>
                      <div className="open-project-plugin-desc">{plugin.description}</div>
                      <span className="open-project-plugin-badge">{plugin.source === 'builtin' ? 'built-in' : 'community'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Footer actions */}
            <div className="arcforge-modal-divider" />
            <div className="open-project-footer">
              <button type="button" className="open-project-footer-btn" onClick={handleImportPlugin} disabled={working}>
                ＋ Import Plugin
              </button>
              <button type="button" className="open-project-footer-btn" onClick={() => setStep('new-plugin')} disabled={working}>
                ⬡ New Plugin
              </button>
            </div>
          </>
        )}

        {/* Step: choose-action */}
        {step === 'choose-action' && selectedPlugin && (
          <div className="open-project-actions">
            {selectedPlugin.canCreateNew && (
              <button type="button" className="open-project-action-btn" onClick={handleCreate} disabled={working}>
                <span className="open-project-action-icon">✦</span>
                <div>
                  <div className="open-project-action-title">Create new</div>
                  <div className="open-project-action-desc">Start a new {selectedPlugin.name} project from scratch</div>
                </div>
              </button>
            )}
            <button type="button" className="open-project-action-btn" onClick={handleOpen} disabled={working}>
              <span className="open-project-action-icon">◉</span>
              <div>
                <div className="open-project-action-title">Open existing</div>
                <div className="open-project-action-desc">
                  Open an existing {selectedPlugin.name} {selectedPlugin.openMode === 'file' ? 'file' : 'folder'}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Step: new-plugin */}
        {step === 'new-plugin' && (
          <div style={{ padding: '20px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b6b7a', lineHeight: 1.5 }}>
              Generates a starter plugin with <code>manifest.json</code>, <code>parser.js</code>, <code>nodes.js</code> and the Arcforge SDK.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12, color: '#9ca3af' }}>
                Plugin ID <span style={{ color: '#ef4444' }}>*</span>
                <input
                  className="arcforge-input"
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  placeholder="my-plugin"
                  value={newPlugin.id}
                  onChange={e => setNewPlugin(p => ({ ...p, id: e.target.value }))}
                />
              </label>

              <label style={{ fontSize: 12, color: '#9ca3af' }}>
                Display Name <span style={{ color: '#ef4444' }}>*</span>
                <input
                  className="arcforge-input"
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  placeholder="My Plugin"
                  value={newPlugin.name}
                  onChange={e => setNewPlugin(p => ({ ...p, name: e.target.value }))}
                />
              </label>

              <label style={{ fontSize: 12, color: '#9ca3af' }}>
                Author
                <input
                  className="arcforge-input"
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  placeholder="Your name"
                  value={newPlugin.author}
                  onChange={e => setNewPlugin(p => ({ ...p, author: e.target.value }))}
                />
              </label>

              <label style={{ fontSize: 12, color: '#9ca3af' }}>
                Accepts
                <select
                  className="arcforge-input"
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={newPlugin.accepts}
                  onChange={e => setNewPlugin(p => ({ ...p, accepts: e.target.value as 'directory' | 'file' }))}
                >
                  <option value="directory">directory — folder picker</option>
                  <option value="file">file — file picker</option>
                </select>
              </label>
            </div>

            {newPluginError && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#ef4444' }}>{newPluginError}</p>
            )}
            {newPluginSuccess && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#34d399', wordBreak: 'break-all' }}>{newPluginSuccess}</p>
            )}

            <button
              type="button"
              className="open-project-action-btn"
              style={{ marginTop: 16, width: '100%' }}
              onClick={handleNewPluginSubmit}
              disabled={working}
            >
              <span className="open-project-action-icon">⬡</span>
              <div>
                <div className="open-project-action-title">Generate Plugin</div>
                <div className="open-project-action-desc">Choose a folder and create the plugin template</div>
              </div>
            </button>
          </div>
        )}

      </div>

      {/* Context menu for community plugins */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="arcforge-context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999 }}
        >
          <button type="button" className="arcforge-context-menu-item" onClick={handleContextReveal}>
            Open Folder
          </button>
          <div className="arcforge-context-menu-separator" />
          <button type="button" className="arcforge-context-menu-item arcforge-context-menu-item--danger" onClick={handleContextDelete}>
            Delete Plugin
          </button>
        </div>
      )}
    </div>
  );
};
