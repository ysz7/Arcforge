/**
 * Source Control panel — list of changed files, stage/unstage, commit.
 * VS Code style.
 */

import React, { useCallback, useState } from 'react';
import { useGitStore } from '../store/gitStore';
import { useNotificationStore } from '../store/notificationStore';
import { PromptModal } from './PromptModal';

declare const window: Window & { arcforge?: import('../global').ArcforgeAPI };

export interface SourceControlPanelProps {
  projectPath: string | null;
  onOpenFile: (relativePath: string, options?: { scrollToLine?: number }) => void;
}

const STATUS_LABELS: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  untracked: 'U',
  renamed: 'R',
};

const STATUS_COLORS: Record<string, string> = {
  modified: '#d7ba7d',
  added: '#4ec9b0',
  deleted: '#f14c4c',
  untracked: '#858585',
  renamed: '#c586c0',
};

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({ projectPath, onOpenFile }) => {
  const { files, loading, error, fetch } = useGitStore();
  const [commitModalOpen, setCommitModalOpen] = useState(false);

  const refresh = useCallback(() => {
    fetch(projectPath);
  }, [projectPath, fetch]);

  React.useEffect(() => {
    fetch(projectPath);
  }, [projectPath, fetch]);

  const handleStage = useCallback(
    async (relativePath: string) => {
      if (!projectPath || !window.arcforge?.git) return;
      const res = await window.arcforge.git.stage(projectPath, relativePath);
      if (res.ok) refresh();
      else useNotificationStore.getState().add('error', res.error ?? 'Stage failed');
    },
    [projectPath, refresh]
  );

  const handleUnstage = useCallback(
    async (relativePath: string) => {
      if (!projectPath || !window.arcforge?.git) return;
      const res = await window.arcforge.git.unstage(projectPath, relativePath);
      if (res.ok) refresh();
      else useNotificationStore.getState().add('error', res.error ?? 'Unstage failed');
    },
    [projectPath, refresh]
  );

  const handleCommit = useCallback(
    async (message: string) => {
      if (!projectPath || !window.arcforge?.git) return;
      const res = await window.arcforge.git.commit(projectPath, message);
      setCommitModalOpen(false);
      if (res.ok) {
        refresh();
        useNotificationStore.getState().add('success', 'Committed');
      } else {
        useNotificationStore.getState().add('error', res.error ?? 'Commit failed');
      }
    },
    [projectPath, refresh]
  );

  if (!projectPath) return null;

  return (
    <div
      className="arcforge-source-control"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid var(--arc-border-subtle)',
        background: 'var(--arc-bg-sidebar)',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid var(--arc-border-subtle)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span>Source Control</span>
        <button
          type="button"
          className="arcforge-toolbar-btn"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>
      {error && (
        <div style={{ padding: 8, fontSize: 11, color: 'var(--arc-text-muted)' }}>{error}</div>
      )}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 200,
        }}
      >
        {files.length === 0 && !loading && !error && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--arc-text-muted)' }}>
            No changes
          </div>
        )}
        {files.map((f) => (
          <div
            key={f.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              fontSize: 11,
              borderBottom: '1px solid var(--arc-border-subtle)',
            }}
          >
            <span
              style={{
                color: STATUS_COLORS[f.status] ?? 'var(--arc-text-muted)',
                fontWeight: 600,
                minWidth: 14,
              }}
            >
              {STATUS_LABELS[f.status] ?? '?'}
            </span>
            <button
              type="button"
              style={{
                flex: 1,
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: 'var(--arc-text)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onClick={() => onOpenFile(f.path)}
            >
              {f.path}
            </button>
            <button
              type="button"
              className="arcforge-toolbar-btn"
              style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={() => handleStage(f.path)}
              title="Stage"
            >
              +
            </button>
            {f.status !== 'untracked' && (
              <button
                type="button"
                className="arcforge-toolbar-btn"
                style={{ padding: '2px 6px', fontSize: 10 }}
                onClick={() => handleUnstage(f.path)}
                title="Unstage"
              >
                −
              </button>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          padding: 6,
          borderTop: '1px solid var(--arc-border-subtle)',
        }}
      >
        <button
          type="button"
          className="arcforge-toolbar-btn"
          style={{ width: '100%', fontSize: 11 }}
          onClick={() => setCommitModalOpen(true)}
          disabled={files.length === 0}
        >
          Commit
        </button>
      </div>
      {commitModalOpen && (
        <PromptModal
          title="Commit"
          placeholder="Commit message"
          onConfirm={handleCommit}
          onCancel={() => setCommitModalOpen(false)}
        />
      )}
    </div>
  );
};
