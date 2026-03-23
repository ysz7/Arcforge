/**
 * File tree for the open project — VS Code / Cursor style explorer.
 * Radix Collapsible for folders; colored file-type icons; proper indentation.
 */

import React, { useCallback, useMemo, useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { ConfirmModal } from './ConfirmModal';
import { PromptModal } from './PromptModal';
import { useGitStore } from '../store/gitStore';
import { useGraphStore } from '../store/graphStore';
import type { GitFileStatus } from '../../../shared/types';

declare const window: Window & { arcforge?: import('../../../shared/types').ArcforgeAPI };

export interface FileExplorerProps {
  projectPath: string | null;
  onOpenFile: (relativePath: string, options?: { scrollToLine?: number }) => void;
}

const GIT_STATUS_COLORS: Record<GitFileStatus, string> = {
  modified: '#d7ba7d',
  added: '#4ec9b0',
  deleted: '#f14c4c',
  untracked: '#858585',
  renamed: '#c586c0',
};

interface Entry {
  name: string;
  isDirectory: boolean;
}

type ExplorerContextTarget =
  | { kind: 'root'; relativePath: ''; name: string }
  | { kind: 'folder'; relativePath: string; name: string; parentPath: string }
  | { kind: 'file'; relativePath: string; name: string; parentPath: string };

const FALLBACK_ROOT_DIRS = ['app', 'routes', 'config', 'database', 'resources', 'bootstrap', 'public'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function projectNameFromPath(path: string): string {
  const segments = path.replace(/\/$|\\$/, '').split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? 'Project';
}

/** For single-file mode: filename without extension, uppercase. */
function singleFileNameForTitle(relativePath: string): string {
  const base = relativePath.replace(/^.*[/\\]/, '');
  const withoutExt = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  return withoutExt.toUpperCase();
}

// ---------------------------------------------------------------------------
// Colored file-type icons (VS Code / Seti style)
// ---------------------------------------------------------------------------

const ICON_COLORS: Record<string, string> = {
  ts: '#3178c6',
  tsx: '#3178c6',
  js: '#f1e05a',
  jsx: '#f1e05a',
  json: '#f1e05a',
  php: '#8892BF',
  md: '#519aba',
  css: '#563d7c',
  scss: '#c6538c',
  html: '#e34c26',
  vue: '#42b883',
  svg: '#ffb13b',
  xml: '#e44d26',
  env: '#ecd53f',
  yml: '#cb171e',
  yaml: '#cb171e',
  lock: '#6b7280',
  git: '#6b7280',
  config: '#6b7280',
  sqlite: '#0f80c1',
  default: '#858585',
};

/** Returns [label, color] for a file's icon badge. */
function getFileIcon(fileName: string): { label: string; color: string } {
  const lower = fileName.toLowerCase();
  const ext = lower.includes('.') ? (lower.split('.').pop() ?? '') : '';

  // Special-case files
  if (lower === 'tsconfig.json') return { label: 'ts', color: ICON_COLORS.ts };
  if (lower === 'vite.config.ts' || lower === 'vite.config.js') return { label: '⚡', color: '#a855f6' };
  if (lower === 'package.json' || lower === 'package-lock.json') return { label: '{}', color: ICON_COLORS.json };
  if (lower === 'composer.json' || lower === 'composer.lock') return { label: '{}', color: ICON_COLORS.json };
  if (lower === '.gitignore' || lower === '.gitattributes') return { label: '◇', color: ICON_COLORS.git };
  if (lower === '.editorconfig') return { label: '◇', color: ICON_COLORS.config };
  if (lower === '.env' || lower.startsWith('.env.')) return { label: '$', color: ICON_COLORS.env };
  if (lower === 'artisan') return { label: '≡', color: ICON_COLORS.php };
  if (lower === 'phpunit.xml') return { label: '⊡', color: '#e44d26' };

  // By extension
  if (ext === 'ts' || ext === 'tsx') return { label: 'TS', color: ICON_COLORS.ts };
  if (ext === 'js' || ext === 'jsx') return { label: 'JS', color: ICON_COLORS.js };
  if (ext === 'json') return { label: '{}', color: ICON_COLORS.json };
  if (ext === 'php') return { label: '◇', color: ICON_COLORS.php };
  if (ext === 'md') return { label: '⬇', color: ICON_COLORS.md };
  if (ext === 'css') return { label: '#', color: ICON_COLORS.css };
  if (ext === 'scss') return { label: '#', color: ICON_COLORS.scss };
  if (ext === 'html') return { label: '<>', color: ICON_COLORS.html };
  if (ext === 'vue') return { label: 'V', color: ICON_COLORS.vue };
  if (ext === 'svg') return { label: '◇', color: ICON_COLORS.svg };
  if (ext === 'xml') return { label: '<>', color: ICON_COLORS.xml };
  if (ext === 'yml' || ext === 'yaml') return { label: '⊡', color: ICON_COLORS.yml };
  if (ext === 'sqlite') return { label: '▤', color: ICON_COLORS.sqlite };
  if (ext === 'lock') return { label: '⊝', color: ICON_COLORS.lock };
  if (ext === 'env') return { label: '$', color: ICON_COLORS.env };

  return { label: '◦', color: ICON_COLORS.default };
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const { label, color } = getFileIcon(fileName);
  return (
    <span className="arcforge-file-icon" style={{ color }} aria-hidden>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Context menu content
// ---------------------------------------------------------------------------

/** Pending modal state for context menu actions. */
type ModalState =
  | null
  | { kind: 'prompt'; title: string; placeholder?: string; defaultValue?: string; onConfirm: (value: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void };

interface ContextMenuContentProps {
  projectPath: string;
  onOpenFile: (relativePath: string, options?: { scrollToLine?: number }) => void;
  menu: {
    target: ExplorerContextTarget;
    refresh: () => void;
  };
  onClose: () => void;
  showModal: (modal: NonNullable<ModalState>) => void;
}

async function safeClipboardWrite(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    // ignore
  }
}

const ContextMenuContent: React.FC<ContextMenuContentProps> = ({
  projectPath,
  onOpenFile,
  menu,
  onClose,
  showModal,
}) => {
  const { target, refresh } = menu;

  const baseFolder =
    target.kind === 'root'
      ? ''
      : target.kind === 'folder'
      ? target.relativePath
      : target.parentPath;

  const handleNewFile = () => {
    onClose();
    showModal({
      kind: 'prompt',
      title: 'New File',
      placeholder: 'filename.php',
      onConfirm: async (name) => {
        const relativePath = baseFolder ? `${baseFolder}/${name}` : name;
        const api = window.arcforge;
        if (!api) return;
        const res = await api.fs.writeFile(projectPath, relativePath, '');
        if (!res.ok) return;
        refresh();
        onOpenFile(relativePath);
      },
    });
  };

  const handleNewFolder = () => {
    onClose();
    showModal({
      kind: 'prompt',
      title: 'New Folder',
      placeholder: 'folder-name',
      onConfirm: async (name) => {
        const api = window.arcforge;
        if (!api) return;
        const relativePath = baseFolder ? `${baseFolder}/${name}` : name;
        const res = await api.fs.mkdir(projectPath, relativePath);
        if (!res.ok) return;
        refresh();
      },
    });
  };

  const handleRename = () => {
    if (target.kind === 'root') return;
    onClose();
    showModal({
      kind: 'prompt',
      title: 'Rename',
      defaultValue: target.name,
      onConfirm: async (nextName) => {
        if (nextName === target.name) return;
        const api = window.arcforge;
        if (!api) return;
        const parent = target.parentPath;
        const fromRelative = target.relativePath;
        const toRelative = parent ? `${parent}/${nextName}` : nextName;
        const res = await api.fs.renamePath(projectPath, fromRelative, toRelative);
        if (!res.ok) return;
        refresh();
      },
    });
  };

  const handleDelete = () => {
    if (target.kind === 'root') return;
    onClose();
    showModal({
      kind: 'confirm',
      title: 'Delete',
      message:
        target.kind === 'file'
          ? `Delete file "${target.name}"?`
          : `Delete folder "${target.name}" and all its contents?`,
      danger: true,
      onConfirm: async () => {
        const api = window.arcforge;
        if (!api) return;
        const res = await api.fs.deletePath(projectPath, target.relativePath);
        if (!res.ok) return;
        refresh();
      },
    });
  };

  const handleReveal = async () => {
    const api = window.arcforge;
    if (!api) return;
    const relativePath = target.kind === 'root' ? '' : target.relativePath;
    await api.fs.revealInExplorer(projectPath, relativePath);
    onClose();
  };

  const handleCopyPath = async () => {
    const relativePath = target.kind === 'root' ? '' : target.relativePath;
    await safeClipboardWrite(relativePath);
    onClose();
  };

  const canRenameOrDelete = target.kind !== 'root';

  return (
    <div className="arcforge-context-menu-inner">
      <button type="button" className="arcforge-context-item" onClick={handleNewFile}>
        New File
      </button>
      <button type="button" className="arcforge-context-item" onClick={handleNewFolder}>
        New Folder
      </button>
      {target.kind === 'file' && (
        <button
          type="button"
          className="arcforge-context-item"
          onClick={() => {
            onOpenFile(target.relativePath);
            onClose();
          }}
        >
          Open
        </button>
      )}
      <hr className="arcforge-context-separator" />
      {canRenameOrDelete && (
        <>
          <button type="button" className="arcforge-context-item" onClick={handleRename}>
            Rename
          </button>
          <button type="button" className="arcforge-context-item arcforge-context-danger" onClick={handleDelete}>
            Delete
          </button>
          <hr className="arcforge-context-separator" />
        </>
      )}
      <button type="button" className="arcforge-context-item" onClick={handleReveal}>
        Reveal in Explorer
      </button>
      <button type="button" className="arcforge-context-item" onClick={handleCopyPath}>
        Copy Relative Path
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chevron SVG (minimalist)
// ---------------------------------------------------------------------------

function Chevron() {
  return (
    <span className="arcforge-chevron" aria-hidden>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2l3 3-3 3" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tree directory node
// ---------------------------------------------------------------------------

function TreeDir({
  projectPath,
  relativePath,
  name,
  onOpenFile,
  onContextMenu,
  level,
  gitStatusMap,
  explorerRefreshTrigger,
}: {
  projectPath: string;
  relativePath: string;
  name: string;
  onOpenFile: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, target: ExplorerContextTarget, refresh: () => void) => void;
  level: number;
  gitStatusMap: Map<string, GitFileStatus>;
  explorerRefreshTrigger?: number;
}) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchChildren = useCallback(() => {
    setLoading(true);
    window.arcforge?.fs.listDir(projectPath, relativePath).then((res) => {
      setLoading(false);
      if (res.ok) {
        const skip = new Set(['node_modules', 'vendor', '.git']);
        const filtered = res.entries.filter((e) => !(e.isDirectory && skip.has(e.name)));
        setChildren(filtered.sort((a, b) => (a.isDirectory === b.isDirectory ? 0 : a.isDirectory ? -1 : 1)));
      }
    });
  }, [projectPath, relativePath]);

  const loadChildren = useCallback(() => {
    if (children !== null) return;
    fetchChildren();
  }, [children, fetchChildren]);

  // Refetch when Forge created/edited files (e.g. new routes/api.php)
  React.useEffect(() => {
    if (children !== null) fetchChildren();
  }, [explorerRefreshTrigger]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) loadChildren();
      setOpen(next);
    },
    [loadChildren]
  );

  // Indentation: 8px base + 16px per level for the chevron
  // Files inside the folder get extra 16px (chevron width placeholder)
  const rowIndent = 8 + level * 16;
  const fileIndent = rowIndent + 16;

  const refreshSelf = useCallback(() => {
    fetchChildren();
  }, [fetchChildren]);

  return (
    <Collapsible.Root open={open} onOpenChange={handleOpenChange}>
      <Collapsible.Trigger
        className="arcforge-tree-row arcforge-folder-trigger"
        style={{ ['--tree-indent' as string]: `${rowIndent}px` }}
        onContextMenu={(e) =>
          onContextMenu(
            e,
            {
              kind: 'folder',
              relativePath,
              name,
              parentPath: relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '',
            },
            refreshSelf
          )
        }
      >
        <Chevron />
        <span className="arcforge-tree-label" title={name}>{name}</span>
        {loading && <span className="arcforge-tree-loading" />}
      </Collapsible.Trigger>
      <Collapsible.Content className="arcforge-tree-content">
        {children &&
          children.map((entry) =>
            entry.isDirectory ? (
              <TreeDir
                key={entry.name}
                projectPath={projectPath}
                relativePath={relativePath ? `${relativePath}/${entry.name}` : entry.name}
                name={entry.name}
                onOpenFile={onOpenFile}
                onContextMenu={onContextMenu}
                level={level + 1}
                gitStatusMap={gitStatusMap}
                explorerRefreshTrigger={explorerRefreshTrigger}
              />
            ) : (
              (() => {
                const filePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                const gitStatus = gitStatusMap.get(filePath);
                return (
                  <button
                    key={entry.name}
                    type="button"
                    className="arcforge-tree-row arcforge-file-row"
                    style={{ ['--tree-indent' as string]: `${fileIndent}px` }}
                    onClick={() => onOpenFile(filePath)}
                    onContextMenu={(e) =>
                      onContextMenu(
                        e,
                        {
                          kind: 'file',
                          relativePath: filePath,
                          name: entry.name,
                          parentPath: relativePath,
                        },
                        refreshSelf
                      )
                    }
                    title={entry.name}
                  >
                    <FileTypeIcon fileName={entry.name} />
                    <span className="arcforge-tree-label">{entry.name}</span>
                    {gitStatus && (
                      <span
                        className="arcforge-git-badge"
                        style={{
                          color: GIT_STATUS_COLORS[gitStatus],
                          marginLeft: 4,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                        title={gitStatus}
                      >
                        {gitStatus === 'modified' ? 'M' : gitStatus === 'added' ? 'A' : gitStatus === 'deleted' ? 'D' : gitStatus === 'untracked' ? 'U' : 'R'}
                      </span>
                    )}
                  </button>
                );
              })()
            )
          )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export const FileExplorer: React.FC<FileExplorerProps> = ({ projectPath, onOpenFile }) => {
  const [rootEntries, setRootEntries] = React.useState<Entry[] | null>(null);
  const explorerRefreshTrigger = useGraphStore((s) => s.explorerRefreshTrigger);
  const entryFileRelative = useGraphStore((s) => s.entryFileRelative);
  const gitFiles = useGitStore((s) => s.files);
  const gitStatusMap = useMemo(() => {
    const m = new Map<string, GitFileStatus>();
    for (const f of gitFiles) m.set(f.path.replace(/\\/g, '/'), f.status);
    return m;
  }, [gitFiles]);
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    target: ExplorerContextTarget;
    refresh: () => void;
  } | null>(null);
  const [modal, setModal] = React.useState<ModalState>(null);

  const loadRoot = React.useCallback(() => {
    if (!projectPath || !window.arcforge) return;
    if (entryFileRelative) {
      setRootEntries([{ name: entryFileRelative, isDirectory: false }]);
      return;
    }
    window.arcforge.fs.listDir(projectPath, '').then((res) => {
      if (res.ok && res.entries.length > 0) {
        const skip = new Set(['node_modules', 'vendor', '.git']);
        const filtered = res.entries.filter((e) => !skip.has(e.name));
        const sorted = filtered.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setRootEntries(sorted);
      } else {
        setRootEntries(FALLBACK_ROOT_DIRS.map((name) => ({ name, isDirectory: true })));
      }
    });
  }, [projectPath, entryFileRelative]);

  React.useEffect(() => {
    loadRoot();
  }, [loadRoot, explorerRefreshTrigger]);

  const closeContextMenu = React.useCallback(() => setContextMenu(null), []);

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent, target: ExplorerContextTarget, refresh: () => void) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target,
        refresh,
      });
    },
    []
  );

  const handleRootContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      if (!projectPath) return;
      event.preventDefault();
      event.stopPropagation();
      const rootName = entryFileRelative ? singleFileNameForTitle(entryFileRelative) : projectNameFromPath(projectPath);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: 'root', relativePath: '', name: rootName },
        refresh: loadRoot,
      });
    },
    [projectPath, entryFileRelative, loadRoot]
  );

  if (!projectPath) {
    return (
      <div style={{ padding: 12, color: '#94a3b8', fontSize: 13 }} role="status">
        Open a project to browse files.
      </div>
    );
  }

  const entries = rootEntries ?? (entryFileRelative ? [{ name: entryFileRelative, isDirectory: false }] : FALLBACK_ROOT_DIRS.map((name) => ({ name, isDirectory: true })));
  const projectName = entryFileRelative ? singleFileNameForTitle(entryFileRelative) : projectNameFromPath(projectPath);

  return (
    <div className="arcforge-explorer" onClick={closeContextMenu}>
      {/* Project header */}
      <div
        className="arcforge-explorer-header"
        title={projectPath}
        onContextMenu={handleRootContextMenu}
      >
        <span className="arcforge-explorer-project-name">{projectName}</span>
      </div>

      {/* Tree */}
      <div className="arcforge-explorer-tree">
        {entries.map((entry) =>
          entry.isDirectory ? (
            <TreeDir
              key={entry.name}
              projectPath={projectPath}
              relativePath={entry.name}
              name={entry.name}
              onOpenFile={onOpenFile}
              onContextMenu={handleContextMenu}
              level={0}
              gitStatusMap={gitStatusMap}
              explorerRefreshTrigger={explorerRefreshTrigger}
            />
          ) : (
            (() => {
              const filePath = entry.name;
              const gitStatus = gitStatusMap.get(filePath);
              return (
                <button
                  key={entry.name}
                  type="button"
                  className="arcforge-tree-row arcforge-file-row"
                  style={{ ['--tree-indent' as string]: '8px' }}
                  onClick={() => onOpenFile(filePath)}
                  onContextMenu={(e) =>
                    handleContextMenu(
                      e,
                      { kind: 'file', relativePath: filePath, name: entry.name, parentPath: '' },
                      loadRoot
                    )
                  }
                  title={entry.name}
                >
                  <FileTypeIcon fileName={entry.name} />
                  <span className="arcforge-tree-label">{entry.name}</span>
                  {gitStatus && (
                    <span
                      style={{
                        color: GIT_STATUS_COLORS[gitStatus],
                        marginLeft: 4,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                      title={gitStatus}
                    >
                      {gitStatus === 'modified' ? 'M' : gitStatus === 'added' ? 'A' : gitStatus === 'deleted' ? 'D' : gitStatus === 'untracked' ? 'U' : 'R'}
                    </span>
                  )}
                </button>
              );
            })()
          )
        )}
      </div>

      {contextMenu && (
        <div
          className="arcforge-context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuContent
            projectPath={projectPath}
            onOpenFile={onOpenFile}
            menu={contextMenu}
            onClose={closeContextMenu}
            showModal={setModal}
          />
        </div>
      )}

      {modal?.kind === 'prompt' && (
        <PromptModal
          title={modal.title}
          placeholder={modal.placeholder}
          defaultValue={modal.defaultValue}
          onConfirm={(value) => {
            modal.onConfirm(value);
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}

      {modal?.kind === 'confirm' && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          danger={modal.danger}
          confirmLabel={modal.danger ? 'Delete' : 'OK'}
          onConfirm={() => {
            modal.onConfirm();
            setModal(null);
          }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
};
