/**
 * Styled alert/warning modal (replaces native alert()).
 * Same minimal Cursor-like style as Delete and Forge modals.
 */

import React from 'react';

interface AlertModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ title, message, onClose }) => {
  return (
    <div className="arcforge-modal-overlay" onClick={onClose}>
      <div className="arcforge-modal arcforge-alert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="arcforge-modal-header">
          <span className="arcforge-modal-title">{title}</span>
          <button type="button" className="arcforge-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="arcforge-alert-message">{message}</p>
        <div className="arcforge-modal-divider" />
        <div className="arcforge-modal-actions">
          <button type="button" className="forge-btn forge-btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
