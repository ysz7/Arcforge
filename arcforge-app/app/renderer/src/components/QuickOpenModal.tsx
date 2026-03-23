/**
 * Quick Open (Ctrl+P) — search files and graph nodes.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface QuickOpenItem {
  id: string;
  label: string;
  filePath?: string;
  type: 'file' | 'node';
}

interface QuickOpenModalProps {
  open: boolean;
  onClose: () => void;
  onOpenFile: (path: string, options?: { scrollToLine?: number }) => void;
  onFocusNode?: (nodeId: string) => void;
  filePaths: string[];
  nodes: Array<{ id: string; label: string; filePath?: string }>;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let j = 0;
  for (let i = 0; i < t.length && j < q.length; i++) {
    if (t[i] === q[j]) j++;
  }
  return j === q.length;
}

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  open,
  onClose,
  onOpenFile,
  onFocusNode,
  filePaths,
  nodes,
}) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items: QuickOpenItem[] = useMemo(() => {
    const result: QuickOpenItem[] = [];
    const q = query.trim();
    for (const fp of filePaths) {
      const label = fp.split('/').pop() ?? fp;
      if (!q || fuzzyMatch(q, fp) || fuzzyMatch(q, label)) {
        result.push({ id: `file:${fp}`, label, filePath: fp, type: 'file' });
      }
    }
    for (const n of nodes) {
      const label = n.label;
      const search = `${label} ${n.filePath ?? ''}`;
      if (!q || fuzzyMatch(q, search) || fuzzyMatch(q, label)) {
        result.push({ id: `node:${n.id}`, label, filePath: n.filePath, type: 'node' });
      }
    }
    return result.slice(0, 50);
  }, [query, filePaths, nodes]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
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
        setSelected((s) => Math.min(s + 1, items.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelected((s) => Math.max(s - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const item = items[selected];
        if (item) {
          if (item.type === 'file' && item.filePath) {
            onOpenFile(item.filePath);
          } else if (item.type === 'node' && item.filePath) {
            onOpenFile(item.filePath);
          } else if (item.type === 'node' && onFocusNode) {
            onFocusNode(item.id.replace('node:', ''));
          }
          onClose();
        }
        e.preventDefault();
      }
    },
    [items, selected, onClose, onOpenFile, onFocusNode]
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
      <div className="arcforge-modal arcforge-quick-open" onClick={(e) => e.stopPropagation()}>
        <div className="arcforge-quick-open-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="arcforge-quick-open-input"
            placeholder="Type to search files and nodes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div ref={listRef} className="arcforge-quick-open-list">
          {items.length === 0 ? (
            <div className="arcforge-quick-open-empty">No results</div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.id}
                className={`arcforge-quick-open-item ${i === selected ? 'is-selected' : ''}`}
                onClick={() => {
                  if ((item.type === 'file' || item.type === 'node') && item.filePath) onOpenFile(item.filePath);
                  else if (item.type === 'node' && onFocusNode) onFocusNode(item.id.replace('node:', ''));
                  onClose();
                }}
              >
                <span className="arcforge-quick-open-label">{item.label}</span>
                {item.filePath && <span className="arcforge-quick-open-path">{item.filePath}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
