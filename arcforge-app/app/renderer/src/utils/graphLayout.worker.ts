/**
 * Web Worker: runs layout (dagre + CLI block) off the main thread
 * so the UI stays responsive and we use an extra CPU core for layout.
 */

import { getLayoutPositions } from './graphLayout';
import type { Node, Edge } from 'reactflow';
import type { ExistingPositions, MeasuredNodeSizesById } from './graphLayout';

export interface LayoutWorkerRequest {
  requestId: number;
  nodes: Node[];
  edges: Edge[];
  projectPath?: string | null;
  existingPositions?: ExistingPositions;
  measuredSizesById?: MeasuredNodeSizesById;
}

export interface LayoutWorkerResponse {
  requestId: number;
  positions: Record<string, { x: number; y: number }>;
}

self.onmessage = (e: MessageEvent<LayoutWorkerRequest>) => {
  const { requestId, nodes, edges, projectPath, existingPositions, measuredSizesById } = e.data;
  try {
    const positions = getLayoutPositions(nodes, edges, projectPath, existingPositions, measuredSizesById);
    const response: LayoutWorkerResponse = { requestId, positions };
    self.postMessage(response);
  } catch (err) {
    self.postMessage({ requestId, positions: {} as Record<string, { x: number; y: number }>, error: String(err) });
  }
};
