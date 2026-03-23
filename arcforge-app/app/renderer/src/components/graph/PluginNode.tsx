/**
 * Generic node component for user-defined plugin node types.
 * Reads color, icon and description from activePluginInfo.nodeTypes via BaseNode.
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { BaseNode, type NodeType } from './BaseNode';

export interface PluginNodeData {
  label: string;
  nodeType: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

const PluginNodeInner: React.FC<NodeProps<PluginNodeData>> = ({ data, id }) => {
  const subtitle = data?.metadata?.description as string | undefined;

  return (
    <>
      <BaseNode
        label={data?.label ?? ''}
        nodeType={data?.nodeType as NodeType}
        filePath={data?.filePath}
        metadata={data?.metadata}
        nodeId={id}
        subtitle={subtitle}
      />
      <Handle type="target" position={Position.Left} className="arcforge-handle arcforge-handle-bottom" />
      <Handle type="source" position={Position.Right} className="arcforge-handle arcforge-handle-bottom" />
    </>
  );
};

export const PluginNode = memo(PluginNodeInner);
