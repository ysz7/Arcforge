/**
 * Dark-themed confirmation modal (replaces native window.confirm).
 * Cursor-style: minimal, dark background, accent buttons.
 */

import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="arcforge-modal-overlay" onClick={onCancel}>
      <div className="arcforge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="arcforge-modal-header">
          <span className="arcforge-modal-title">{title}</span>
          <button type="button" className="arcforge-modal-close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="arcforge-alert-message">{message}</p>
        <div className="arcforge-modal-divider" />
        <div className="arcforge-modal-actions">
          <button type="button" className="forge-btn forge-btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`forge-btn ${danger ? 'forge-btn-danger' : 'forge-btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
