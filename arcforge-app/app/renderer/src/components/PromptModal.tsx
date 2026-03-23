/**
 * Dark-themed prompt modal (replaces native window.prompt).
 * Cursor-style: minimal, dark background, accent input.
 */

import React, { useRef, useEffect, useState } from 'react';

interface PromptModalProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  title,
  placeholder = '',
  defaultValue = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select content
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  };

  return (
    <div className="arcforge-modal-overlay" onClick={onCancel}>
      <div className="arcforge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="arcforge-modal-header">
          <span className="arcforge-modal-title">{title}</span>
          <button type="button" className="arcforge-modal-close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="arcforge-prompt-body">
          <input
            ref={inputRef}
            className="arcforge-prompt-input"
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>
        <div className="arcforge-modal-divider" />
        <div className="arcforge-modal-actions">
          <button type="button" className="forge-btn forge-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="forge-btn forge-btn-primary"
            disabled={!value.trim()}
            onClick={handleSubmit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
