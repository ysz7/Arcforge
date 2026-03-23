/**
 * Command Palette (Ctrl+Shift+P) — run commands.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCommands, subscribeCommands } from '../store/commandStore';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [commands, setCommands] = useState(getCommands());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeCommands(() => setCommands(getCommands()));
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setCommands(getCommands());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelected((s) => Math.max(s - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const cmd = filtered[selected];
        if (cmd) {
          cmd.run();
          onClose();
        }
        e.preventDefault();
      }
    },
    [filtered, selected, onClose]
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const child = el.children[selected] as HTMLElement | undefined;
    child?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  return (
    <div className="arcforge-modal-overlay" onClick={onClose}>
      <div className="arcforge-modal arcforge-command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="arcforge-command-palette-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="arcforge-command-palette-input"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div ref={listRef} className="arcforge-command-palette-list">
          {filtered.length === 0 ? (
            <div className="arcforge-command-palette-empty">No commands found</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`arcforge-command-palette-item ${i === selected ? 'is-selected' : ''}`}
                onClick={() => {
                  cmd.run();
                  onClose();
                }}
              >
                <span className="arcforge-command-palette-label">{cmd.label}</span>
                {cmd.shortcut && <span className="arcforge-command-palette-shortcut">{cmd.shortcut}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
