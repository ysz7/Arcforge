/**
 * Tasks panel — run Composer/Artisan commands.
 * Whitelisted commands only; terminal-like output.
 */

import React, { useCallback, useRef } from 'react';
import { useNotificationStore } from '../store/notificationStore';

declare const window: Window & { arcforge?: import('../global').ArcforgeAPI };

const PRESET_COMMANDS = [
  { label: 'composer install', command: 'composer install' },
  { label: 'composer update', command: 'composer update' },
  { label: 'php artisan migrate', command: 'php artisan migrate' },
  { label: 'php artisan route:list', command: 'php artisan route:list' },
  { label: 'php artisan config:clear', command: 'php artisan config:clear' },
  { label: 'php artisan test', command: 'php artisan test' },
];

export interface TasksPanelProps {
  projectPath: string | null;
}

export const TasksPanel: React.FC<TasksPanelProps> = ({ projectPath }) => {
  const [output, setOutput] = React.useState<string>('');
  const [running, setRunning] = React.useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  const runCommand = useCallback(
    async (command: string) => {
      if (!projectPath || !window.arcforge?.shell) return;
      setRunning(true);
      setOutput((prev) => `${prev}\n$ ${command}\n`);
      try {
        const res = await window.arcforge.shell.run(projectPath, command);
        const combined = [res.stdout, res.stderr].filter(Boolean).join('\n');
        setOutput((prev) => `${prev}${combined}\n`);
        if (!res.ok && res.error) {
          useNotificationStore.getState().add('error', res.error);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setOutput((prev) => `${prev}${msg}\n`);
        useNotificationStore.getState().add('error', msg);
      } finally {
        setRunning(false);
      }
    },
    [projectPath]
  );

  React.useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [output]);

  if (!projectPath) return null;

  return (
    <div
      className="arcforge-tasks-panel"
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
          padding: '6px 10px',
          borderBottom: '1px solid var(--arc-border-subtle)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        Tasks
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: 8,
          borderBottom: '1px solid var(--arc-border-subtle)',
        }}
      >
        {PRESET_COMMANDS.map(({ label, command }) => (
          <button
            key={command}
            type="button"
            className="arcforge-toolbar-btn"
            style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={() => runCommand(command)}
            disabled={running}
          >
            {label}
          </button>
        ))}
      </div>
      <pre
        ref={outputRef}
        style={{
          flex: 1,
          margin: 0,
          padding: 8,
          fontSize: 11,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          background: 'var(--arc-bg)',
          color: 'var(--arc-text)',
          overflow: 'auto',
          maxHeight: 180,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {output || 'Run a command above.'}
      </pre>
    </div>
  );
};
