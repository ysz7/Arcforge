/**
 * Diff view based on Monaco diff editor (inline),
 * with Cursor-style Undo / Keep buttons.
 */

import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

export interface DiffEditorPanelProps {
  relativePath: string;
  original: string;
  modified: string;
  isNew: boolean;
  /** Called when user keeps this single file. */
  onKeepFile?: () => void;
  /** Called when user undoes (discards) this single file. */
  onUndoFile?: () => void;
}

const languageByExt: Record<string, string> = {
  '.php': 'php',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.blade.php': 'php',
};

function getLanguage(path: string): string {
  if (path.endsWith('.blade.php')) return 'php';
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  const ext = dot > slash ? path.slice(dot) : '';
  return languageByExt[ext] ?? 'plaintext';
}

export const DiffEditorPanel: React.FC<DiffEditorPanelProps> = ({
  relativePath,
  original,
  modified,
  isNew,
  onKeepFile,
  onUndoFile,
}) => {
  // Keyboard shortcut: Ctrl+Shift+Y → keep file
  React.useEffect(() => {
    if (!onKeepFile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onKeepFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKeepFile]);

  // Keyboard shortcut: Ctrl+N → undo file
  React.useEffect(() => {
    if (!onUndoFile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onUndoFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUndoFile]);

  const language = getLanguage(relativePath);
  const showActions = onKeepFile || onUndoFile;

  return (
    <div className="arcforge-diff-inline">
      {isNew && <div className="arcforge-diff-new-badge">New file</div>}
      {showActions && (
        <div className="arcforge-diff-actions-bar arcforge-diff-actions-floating">
          {onUndoFile && (
            <button
              type="button"
              className="arcforge-diff-action-btn"
              onClick={onUndoFile}
            >
              Undo <span className="arcforge-diff-action-kbd">Ctrl+N</span>
            </button>
          )}
          {onKeepFile && (
            <button
              type="button"
              className="arcforge-diff-action-btn arcforge-diff-action-keep"
              onClick={onKeepFile}
            >
              Keep <span className="arcforge-diff-action-kbd">Ctrl+Shift+Y</span>
            </button>
          )}
        </div>
      )}
      <div className="arcforge-diff-editor-wrap">
        <DiffEditor
          original={original}
          modified={modified}
          language={language}
          theme={document.documentElement.dataset.theme === 'light' ? 'vs-light' : 'vs-dark'}
          options={{
            readOnly: true,
            renderSideBySide: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            wordWrap: 'on',
            glyphMargin: false,
            renderIndicators: false,
            renderOverviewRuler: false,
          }}
        />
      </div>
    </div>
  );
};
