/**
 * Analysis issues panel — VS Code Problems style.
 * Lists errors/warnings from analysis; click to open file at line.
 */

import React from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { AnalysisIssue } from '../../../shared/types';

export interface IssuesPanelProps {
  issues: AnalysisIssue[];
  onOpenFile: (relativePath: string, options?: { scrollToLine?: number }) => void;
}

export const IssuesPanel: React.FC<IssuesPanelProps> = ({ issues, onOpenFile }) => {
  const [open, setOpen] = React.useState(issues.length > 0);

  React.useEffect(() => {
    if (issues.length > 0 && !open) setOpen(true);
  }, [issues.length, open]);

  if (issues.length === 0) return null;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger
        className="arcforge-issues-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderTop: '1px solid var(--arc-border-subtle)',
          background: 'var(--arc-bg-sidebar)',
          color: 'var(--arc-text)',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          border: 'none',
        }}
      >
        <span
          style={{
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s',
            fontSize: 10,
          }}
        >
          ▶
        </span>
        <span>Problems</span>
        <span style={{ color: 'var(--arc-text-muted)', fontWeight: 400 }}>
          ({issues.length})
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div
          className="arcforge-issues-list"
          style={{
            maxHeight: 160,
            overflowY: 'auto',
            borderTop: '1px solid var(--arc-border-subtle)',
            background: 'var(--arc-bg)',
          }}
        >
          {issues.map((issue, i) => (
            <button
              key={`${issue.filePath ?? ''}-${issue.line ?? 0}-${i}`}
              type="button"
              className="arcforge-issue-item"
              onClick={() => {
                if (issue.filePath) {
                  onOpenFile(issue.filePath, {
                    scrollToLine: issue.line,
                  });
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '6px 10px',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                color: 'var(--arc-text)',
                fontSize: 11,
                cursor: issue.filePath ? 'pointer' : 'default',
                borderBottom: '1px solid var(--arc-border-subtle)',
              }}
            >
              {issue.filePath && (
                <span
                  style={{
                    color: 'var(--arc-accent)',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}
                >
                  {issue.filePath}
                  {issue.line != null ? `:${issue.line}` : ''}
                </span>
              )}
              <span
                style={{
                  color: 'var(--arc-text-muted)',
                  fontSize: 11,
                  lineHeight: 1.3,
                }}
              >
                {issue.message}
              </span>
            </button>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
