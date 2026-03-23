/**
 * Test results panel — PHPUnit output, pass/fail list, click to open file.
 */

import React, { useCallback, useState } from 'react';
import type { TestResult } from '../../../shared/types';
import { useNotificationStore } from '../store/notificationStore';
import { useTestResultsStore } from '../store/testResultsStore';

export interface TestResultsPanelProps {
  projectPath: string | null;
  onOpenFile: (relativePath: string, options?: { scrollToLine?: number }) => void;
}

export const TestResultsPanel: React.FC<TestResultsPanelProps> = ({ projectPath, onOpenFile }) => {
  const { results, loading, runTests } = useTestResultsStore();
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');

  const handleRun = useCallback(() => {
    runTests(projectPath).catch((err) => {
      useNotificationStore.getState().add('error', err instanceof Error ? err.message : String(err));
    });
  }, [projectPath, runTests]);

  const filtered = results.filter((r) => {
    if (filter === 'pass') return r.status === 'pass';
    if (filter === 'fail') return r.status === 'fail';
    return true;
  });

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  if (!projectPath) return null;

  return (
    <div
      className="arcforge-test-results-panel"
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
        <span>Test Results</span>
        <button
          type="button"
          className="arcforge-toolbar-btn"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={handleRun}
          disabled={loading}
        >
          {loading ? 'Running…' : 'Run tests'}
        </button>
      </div>
      {results.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '4px 10px',
            fontSize: 11,
            borderBottom: '1px solid var(--arc-border-subtle)',
          }}
        >
          <span style={{ color: 'var(--arc-text-muted)' }}>
            {passCount} pass, {failCount} fail
          </span>
          <button
            type="button"
            className="arcforge-toolbar-btn"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              background: filter === 'all' ? 'var(--arc-bg-hover)' : undefined,
            }}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className="arcforge-toolbar-btn"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              color: '#4ec9b0',
              background: filter === 'pass' ? 'var(--arc-bg-hover)' : undefined,
            }}
            onClick={() => setFilter('pass')}
          >
            Pass
          </button>
          <button
            type="button"
            className="arcforge-toolbar-btn"
            style={{
              fontSize: 10,
              padding: '2px 6px',
              color: '#f14c4c',
              background: filter === 'fail' ? 'var(--arc-bg-hover)' : undefined,
            }}
            onClick={() => setFilter('fail')}
          >
            Fail
          </button>
        </div>
      )}
      <div
        className="arcforge-test-results-list"
        style={{
          flex: 1,
          overflow: 'auto',
          maxHeight: 180,
        }}
      >
        {filtered.length === 0 && !loading && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--arc-text-muted)' }}>
            Click "Run tests" to run PHPUnit.
          </div>
        )}
        {filtered.map((r, i) => (
          <button
            key={`${r.class}-${r.name}-${i}`}
            type="button"
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
              cursor: r.file ? 'pointer' : 'default',
              borderBottom: '1px solid var(--arc-border-subtle)',
            }}
            onClick={() => r.file && onOpenFile(r.file, { scrollToLine: r.line })}
          >
            <span
              style={{
                color: r.status === 'pass' ? '#4ec9b0' : '#f14c4c',
                fontWeight: 600,
              }}
            >
              {r.status === 'pass' ? '✓' : '✗'} {r.class}::{r.name}
            </span>
            {r.file && (
              <span style={{ color: 'var(--arc-accent)', fontSize: 10 }}>
                {r.file}
                {r.line ? `:${r.line}` : ''}
              </span>
            )}
            {r.message && (
              <span style={{ color: 'var(--arc-text-muted)', fontSize: 10 }}>{r.message}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
