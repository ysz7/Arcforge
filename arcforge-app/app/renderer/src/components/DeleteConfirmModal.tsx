/**
 * Confirmation modal for node deletion.
 * For route_resource: only "Delete entire chain" (resource + routes + full flow).
 * For other nodes: "Only this node" or "This node and entire subsequent flow".
 */

import React from 'react';

export type DeleteMode = 'node' | 'flow' | 'chain';

interface DeleteConfirmModalProps {
  nodeId: string;
  nodeLabel: string;
  /** When 'route_resource', only "Delete entire chain" is shown (same effect as flow). */
  nodeType?: string;
  /** When true, this dialog represents bulk delete of multiple selected nodes. */
  isBulk?: boolean;
  onConfirm: (mode: DeleteMode) => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  nodeLabel,
  isBulk = false,
  onConfirm,
  onCancel,
}) => {

  return (
    <div className="arcforge-modal-overlay" onClick={onCancel}>
      <div className="arcforge-modal arcforge-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="arcforge-modal-header">
          <span className="arcforge-modal-title">Delete node</span>
          <button type="button" className="arcforge-modal-close" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        {isBulk ? (
          <div className="arcforge-danger-box" style={{ margin: '14px 20px 4px' }}>
            <div className="arcforge-danger-box-title">⚠ This cannot be undone</div>
            <div className="arcforge-danger-box-desc">
              Remove all selected nodes from the graph.
            </div>
          </div>
        ) : (
          <p className="arcforge-delete-question">
            Delete <strong>{nodeLabel}</strong>?
          </p>
        )}
        <div className="arcforge-modal-divider" />
        <div className="arcforge-modal-actions">
          <button type="button" className="forge-btn forge-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="forge-btn forge-btn-danger"
            onClick={() => onConfirm('node')}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
