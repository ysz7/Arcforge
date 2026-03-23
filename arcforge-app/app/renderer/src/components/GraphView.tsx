/**
 * React Flow visualization of the architecture graph.
 * Blueprint-style: Entry → Controllers → Routes / Services → Models.
 */

import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Position,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Viewport,
  type Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { ArcforgeGraph } from '../global';
import { useGraphStore } from '../store/graphStore';
import { isConnectionAllowed } from '../../../shared/allowedConnections';
import { useViewStore } from '../store/viewStore';
import {
  buildLayoutedNodesFromPositions,
  type MeasuredNodeSizesById,
  type LayoutPositions,
} from '../utils/graphLayout';
import { nodeTypes as staticNodeTypes, NODE_COLORS, PluginNode } from './graph';
import type { NodeTypes } from 'reactflow';
import { ForgeModal } from './forge/ForgeModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { DeleteMode } from './DeleteConfirmModal';
import { PromptModal } from './PromptModal';
import { AlertModal } from './AlertModal';
import { ExportArchitectureModal } from './ExportArchitectureModal';
import type { GraphViewport, GraphNodePositions } from '../store/graphStore';

declare const window: Window & { arcforge?: import('../../../shared/types').ArcforgeAPI };

const ENTRY_ID = '__arcforge_entry__';

/**
 * Stable key for position persistence — survives node ID changes across plugin re-parses.
 * Priority: nodeType@filePath:line > nodeType@filePath:label > null
 *
 * Using filePath alone (without line or label) is UNSAFE because multiple nodes can share
 * the same file (e.g. all routes live in routes/api.php), which would collapse them to one key.
 */
function getStablePositionKey(node: Node): string | null {
  const nt = (node.data as { nodeType?: string })?.nodeType ?? node.type;
  const filePath = (node.data as { filePath?: string })?.filePath;
  const line = (node.data as { metadata?: { line?: number } })?.metadata?.line;
  const label = (node.data as { label?: string })?.label;
  if (!nt || typeof filePath !== 'string' || !filePath.trim()) return null;
  if (line != null) return `${nt}@${filePath}:${line}`;
  if (typeof label === 'string' && label.trim()) return `${nt}@${filePath}:${label}`;
  return null;
}

function applySavedPositions(nodes: Node[], saved: GraphNodePositions | null): Node[] {
  if (!saved || Object.keys(saved).length === 0) return nodes;
  return nodes.map((n) => {
    const byId = saved[n.id];
    const stableKey = getStablePositionKey(n);
    const byStable = stableKey ? saved[stableKey] : undefined;
    const position = byId ?? byStable ?? n.position;
    return { ...n, position };
  });
}

/** Returns true if saved has a position for every node (by id or stable key). */
function hasFullPositionCoverage(nodes: Node[], saved: GraphNodePositions | null): boolean {
  if (!saved || Object.keys(saved).length === 0) return false;
  for (const n of nodes) {
    const byId = saved[n.id];
    const stableKey = getStablePositionKey(n);
    const byStable = stableKey ? saved[stableKey] : undefined;
    if (!byId && !byStable) return false;
  }
  return true;
}

/** Node types that can be deleted (match main process DELETABLE_NODE_TYPES). */
const DELETABLE_NODE_TYPES = new Set([
  'arch_domain',
  'arch_aggregate',
  'arch_bounded_context',
  'arch_application_service',
  'arch_domain_event',
  'arch_entity',
  'arch_value_object',
  'arch_service',
  'arch_use_case',
  'arch_interface',
  'arch_repository',
  'arch_repository_interface',
  'arch_module',
  'arch_layer',
  'arch_model',
  'arch_view',
  'arch_controller',
  'arch_microservice',
  'arch_event',
  'arch_handler',
  'arch_listener',
  'arch_job',
  'arch_middleware',
  'arch_router',
  'arch_form_request',
  'arch_resource',
  'arch_response',
  'arch_database',
  'arch_entry_interface',
  'arch_eloquent',
  'arch_orm',
  'arch_migration',
  'arch_seeder',
  'arch_factory',
  'arch_di_container',
  'arch_component',
  'arch_entry', // Extra entry nodes (main entry arch:entry cannot be deleted)
]);

// Graph node types that we keep in the data model but do NOT visualize in React Flow.
const HIDDEN_GRAPH_NODE_TYPES = new Set<string>();

/** Returns nodes and effectiveEdges for layout (used by worker and by graphToFlow). */
function getGraphLayoutInput(
  graph: ArcforgeGraph,
  projectPath?: string | null
): { nodes: Node[]; effectiveEdges: Edge[] } {
  const graphNodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const hiddenNodeIds = new Set(
    graph.nodes.filter((n) => HIDDEN_GRAPH_NODE_TYPES.has(n.type as string)).map((n) => n.id)
  );

  let nodes: Node[] = graph.nodes
    .filter((n) => !HIDDEN_GRAPH_NODE_TYPES.has(n.type as string))
    .map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: 0, y: 0 },
      className: n.filePath?.trim() ? 'arcforge-node-clickable' : undefined,
      data: {
        label: n.label,
        nodeType: n.type,
        filePath: n.filePath,
        metadata: n.metadata,
      },
    }));

  const effectiveEdges: Edge[] = graph.edges
    .filter((e) => !hiddenNodeIds.has(e.from) && !hiddenNodeIds.has(e.to))
    .map((e) => {
      const edge: Edge = {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'default',
        className: e.type,
      };
      const withHandle = e as unknown as { sourceHandle?: string; targetHandle?: string };
      if (withHandle.sourceHandle) edge.sourceHandle = withHandle.sourceHandle;
      if (withHandle.targetHandle) edge.targetHandle = withHandle.targetHandle;
      return edge;
    });

  return { nodes, effectiveEdges };
}

/**
 * Type-column layout for plugin graphs.
 * Each distinct nodeType gets its own vertical column in the order defined by pluginTypeOrder.
 * Nodes within a column are sorted alphabetically by label.
 * Much better than a single vertical pile when most nodes have no edges.
 */
function typeColumnLayout(nodes: Node[], pluginTypeOrder: string[]): Node[] {
  const X_GAP = 340;
  const Y_GAP = 110;

  const typeToCol = new Map(pluginTypeOrder.map((t, i) => [t, i]));

  // Group by column index
  const columns = new Map<number, Node[]>();
  for (const n of nodes) {
    const nt = (n.data as { nodeType?: string })?.nodeType ?? '';
    const col = typeToCol.has(nt) ? typeToCol.get(nt)! : pluginTypeOrder.length;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(n);
  }

  // Sort each column alphabetically by label
  for (const colNodes of columns.values()) {
    colNodes.sort((a, b) => {
      const la = (a.data as { label?: string })?.label ?? '';
      const lb = (b.data as { label?: string })?.label ?? '';
      return la.localeCompare(lb);
    });
  }

  const layouted: Node[] = [];
  for (const [col, colNodes] of Array.from(columns.entries()).sort(([a], [b]) => a - b)) {
    const x = col * X_GAP;
    const totalH = (colNodes.length - 1) * Y_GAP;
    const startY = -totalH / 2;
    colNodes.forEach((n, i) => {
      layouted.push({
        ...n,
        position: { x, y: startY + i * Y_GAP },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });
  }
  return layouted;
}

function simpleTreeLayout(
  nodes: Node[],
  edges: Edge[],
  adapterId: string | null,
  projectPath: string | null,
  pluginTypeOrder?: string[]
): Node[] {
  if (nodes.length === 0) return nodes;

  // For plugin graphs: use type-column layout when plugin type order is provided.
  if (pluginTypeOrder && pluginTypeOrder.length > 0) {
    return typeColumnLayout(nodes, pluginTypeOrder);
  }

  const workNodes: Node[] = [...nodes];
  const workEdges: Edge[] = [...edges];

  const nodeById = new Map(workNodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  for (const e of workEdges) {
    const from = e.source;
    const to = e.target;
    if (!nodeById.has(from) || !nodeById.has(to)) continue;
    if (from === to) continue;
    if (!children.has(from)) children.set(from, []);
    children.get(from)!.push(to);
    if (!parents.has(to)) parents.set(to, []);
    parents.get(to)!.push(from);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
  }

  const rootIds: string[] = [];

  // Prefer arch_entry nodes as roots
  for (const n of workNodes) {
    const nt = (n.data as { nodeType?: string } | undefined)?.nodeType;
    if (nt === 'arch_entry') {
      rootIds.push(n.id);
    }
  }

  // Fallback: nodes without incoming edges
  if (rootIds.length === 0) {
    for (const n of workNodes) {
      if (!incoming.has(n.id)) rootIds.push(n.id);
    }
  }

  // Last resort: first node
  if (rootIds.length === 0 && workNodes.length > 0) {
    rootIds.push(workNodes[0]!.id);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];

  for (const id of rootIds) {
    depth.set(id, 0);
    queue.push(id);
  }

  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    const childs = children.get(id) ?? [];
    for (const c of childs) {
      if (depth.has(c)) continue;
      depth.set(c, d + 1);
      queue.push(c);
    }
  }

  // Ноды без глубины считаем корневыми (слой 0)
  for (const n of workNodes) {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  }

  const layers = new Map<number, Node[]>();
  for (const n of workNodes) {
    const d = depth.get(n.id) ?? 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  }

  const X_GAP = 320;
  const Y_GAP = 150;
  const GROUP_GAP = 24;

  const layouted: Node[] = [];
  const sortedDepths = Array.from(layers.keys()).sort((a, b) => a - b);

  const verticalOrder = new Map<string, number>();

  for (const d of sortedDepths) {
    const layerNodes = layers.get(d)!;
    layerNodes.sort((a, b) => {
      const parentsA = parents.get(a.id) ?? [];
      const parentsB = parents.get(b.id) ?? [];

      const parentOrderA =
        parentsA.length > 0
          ? Math.min(
              ...parentsA.map((pid) =>
                verticalOrder.has(pid) ? verticalOrder.get(pid)! : Number.MAX_SAFE_INTEGER
              )
            )
          : Number.MAX_SAFE_INTEGER;

      const parentOrderB =
        parentsB.length > 0
          ? Math.min(
              ...parentsB.map((pid) =>
                verticalOrder.has(pid) ? verticalOrder.get(pid)! : Number.MAX_SAFE_INTEGER
              )
            )
          : Number.MAX_SAFE_INTEGER;

      if (parentOrderA !== parentOrderB) return parentOrderA - parentOrderB;

      const la = ((a.data as { label?: string })?.label ?? '') as string;
      const lb = ((b.data as { label?: string })?.label ?? '') as string;
      return la.localeCompare(lb);
    });
    const x = d * X_GAP;
    let yOffset = 0;
    let prevParentOrder: number | null = null;
    const positionsInLayer: number[] = [];
    for (let i = 0; i < layerNodes.length; i++) {
      const n = layerNodes[i]!;
      const parentsN = parents.get(n.id) ?? [];
      const parentOrder =
        parentsN.length > 0
          ? Math.min(
              ...parentsN.map((pid) =>
                verticalOrder.has(pid) ? verticalOrder.get(pid)! : Number.MAX_SAFE_INTEGER
              )
            )
          : Number.MAX_SAFE_INTEGER;
      if (prevParentOrder !== null && parentOrder !== prevParentOrder) {
        yOffset += GROUP_GAP;
      }
      prevParentOrder = parentOrder;
      positionsInLayer.push(yOffset);
      yOffset += Y_GAP;
    }
    const totalH = yOffset;
    const startY = -totalH / 2 + Y_GAP / 2;
    layerNodes.forEach((n, index) => {
      const y = startY + positionsInLayer[index]!;
      verticalOrder.set(n.id, index);
      layouted.push({
        ...n,
        position: { x, y },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });
  }

  return layouted;
}

function graphToFlow(
  graph: ArcforgeGraph,
  projectPath: string | null,
  existingPositions: GraphNodePositions | null,
  measuredSizesById: MeasuredNodeSizesById | undefined,
  workerPositions: LayoutPositions | null,
  adapterId: string | null,
  pluginTypeOrder?: string[]
): { nodes: Node[]; edges: Edge[] } {
  const input = getGraphLayoutInput(graph, projectPath);
  // Prefer saved positions when we have full coverage — prevents nodes from jumping when only edges change.
  const hasWorkerPositions = workerPositions != null && Object.keys(workerPositions).length > 0;
  const hasSavedFullCoverage = hasFullPositionCoverage(input.nodes, existingPositions);
  const positionsToUse =
    hasSavedFullCoverage
      ? existingPositions ?? undefined
      : (hasWorkerPositions ? workerPositions : existingPositions) ?? undefined;

  let layoutedNodes: Node[];
  if (positionsToUse != null && Object.keys(positionsToUse).length > 0) {
    layoutedNodes = buildLayoutedNodesFromPositions(input.nodes, positionsToUse, projectPath);
    layoutedNodes = layoutedNodes.filter((n) => n.id !== ENTRY_ID);
  } else {
    layoutedNodes = simpleTreeLayout(input.nodes, input.effectiveEdges, adapterId, projectPath, pluginTypeOrder);
  }

  return { nodes: layoutedNodes, edges: [...input.effectiveEdges] };
}

interface GraphViewProps {
  graph: ArcforgeGraph;
  /** Called when a node with a file is clicked; opens that file in a tab. Options (e.g. scrollToLine) used for route nodes. */
  onOpenFile?: (relativePath: string, options?: { scrollToLine?: number }) => void;
  /** Called when a Forge execution completes (so parent can refresh undo stack). */
  onForgeDone?: () => void;
}

/**
 * Wrapper: ReactFlowProvider must sit above any useReactFlow() call,
 * so the exported component wraps the inner one.
 */
export const GraphView: React.FC<GraphViewProps> = (props) => (
  <ReactFlowProvider>
    <GraphViewInner {...props} />
  </ReactFlowProvider>
);

/** Layout worker: runs dagre off the main thread to use an extra core and keep UI responsive. */
function createLayoutWorker(): Worker {
  return new Worker(new URL('../utils/graphLayout.worker.ts', import.meta.url), { type: 'module' });
}

const GraphViewInner: React.FC<GraphViewProps> = ({ graph, onOpenFile, onForgeDone }) => {
  const rfInstance = useReactFlow();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const marqueeSelectionRef = React.useRef<Set<string> | null>(null);
  const didMeasuredLayoutRef = React.useRef(false);

  React.useEffect(() => {
    const handler = () => {
      didMeasuredLayoutRef.current = false;
    };
    window.addEventListener('arcforge:resetLayoutRef', handler);
    return () => window.removeEventListener('arcforge:resetLayoutRef', handler);
  }, []);

  const layoutWorkerRef = React.useRef<Worker | null>(null);
  const layoutRequestIdRef = React.useRef(0);
  const [workerLayoutPositions, setWorkerLayoutPositions] = React.useState<LayoutPositions | null>(null);
  const minimapVisible = useViewStore((s) => s.minimapVisible);
  const controlsVisible = useViewStore((s) => s.controlsVisible);
  const projectPath = useGraphStore((s) => s.projectPath);

  // Reset layout state on every project change so stale positions don't bleed into new projects.
  React.useEffect(() => {
    didMeasuredLayoutRef.current = false;
    setWorkerLayoutPositions(null);
  }, [projectPath]);
  const adapterId = useGraphStore((s) => s.adapterId);
  const activePluginInfo = useGraphStore((s) => s.activePluginInfo);

  // Extend static nodeTypes with plugin-defined types (all mapped to PluginNode).
  // Do NOT override built-in static types (e.g. arch_*) — ArchitectureNode already handles them correctly.
  const nodeTypes = useMemo<NodeTypes>(() => {
    if (!activePluginInfo?.nodeTypes?.length) return staticNodeTypes;
    const extra: NodeTypes = {};
    for (const nt of activePluginInfo.nodeTypes) {
      if (staticNodeTypes[nt.id]) continue; // keep ArchitectureNode for built-in types
      extra[nt.id] = PluginNode as React.ComponentType<never>;
    }
    return { ...staticNodeTypes, ...extra };
  }, [activePluginInfo]);

  const graphViewport = useGraphStore((s) => s.graphViewport);
  const setGraphViewport = useGraphStore((s) => s.setGraphViewport);
  const graphNodePositions = useGraphStore((s) => s.graphNodePositions);
  const positionsReady = useGraphStore((s) => s.positionsReady);
  const graphUpdateFromForge = useGraphStore((s) => s.graphUpdateFromForge);
  const setGraphNodePositions = useGraphStore((s) => s.setGraphNodePositions);
  const analysisStatus = useGraphStore((s) => s.analysisStatus);

  let analysisStatusText: string | null = null;
  let showAnalysisStatus = false;
  if (analysisStatus && analysisStatus.phase !== 'done') {
    const hasFileCounters =
      typeof analysisStatus.current === 'number' &&
      typeof analysisStatus.total === 'number' &&
      analysisStatus.total > 0;
    if (hasFileCounters) {
      analysisStatusText = `Indexing files ${analysisStatus.current}/${analysisStatus.total}`;
      showAnalysisStatus = true;
    }
  }

  // Track current viewport in a ref so we can save reliably on unmount.
  const viewportRef = React.useRef<Viewport>(
    graphViewport ?? { x: 0, y: 0, zoom: 1 }
  );

  // When React Flow is ready, restore saved viewport or fitView.
  const handleInit = React.useCallback(() => {
    const saved = useGraphStore.getState().graphViewport;
    if (saved) {
      rfInstance.setViewport(saved, { duration: 0 });
    } else {
      rfInstance.fitView();
    }
  }, [rfInstance]);

  // Save viewport when user finishes moving/zooming the canvas.
  const handleMoveEnd = React.useCallback(
    (_event: MouseEvent | TouchEvent | null, vp: Viewport) => {
      viewportRef.current = vp;
      setGraphViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
    },
    [setGraphViewport]
  );

  // Capture viewport during pan/zoom; throttle store updates to reduce re-renders in dense graphs.
  const viewportSaveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMove = React.useCallback(
    (_event: MouseEvent | TouchEvent | null, vp: Viewport) => {
      viewportRef.current = vp;
      if (viewportSaveTimeoutRef.current) clearTimeout(viewportSaveTimeoutRef.current);
      viewportSaveTimeoutRef.current = setTimeout(() => {
        viewportSaveTimeoutRef.current = null;
        const latest = viewportRef.current;
        setGraphViewport({ x: latest.x, y: latest.y, zoom: latest.zoom });
      }, 280);
    },
    [setGraphViewport]
  );

  // Save viewport on unmount from the ref (React Flow store may already be gone).
  React.useEffect(() => {
    return () => {
      if (viewportSaveTimeoutRef.current) {
        clearTimeout(viewportSaveTimeoutRef.current);
        viewportSaveTimeoutRef.current = null;
      }
      const vp = viewportRef.current;
      useGraphStore.getState().setGraphViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
    };
  }, []);

  // Flush viewport to store when window is about to close (before renderer is destroyed).
  React.useEffect(() => {
    const flush = () => {
      if (viewportSaveTimeoutRef.current) {
        clearTimeout(viewportSaveTimeoutRef.current);
        viewportSaveTimeoutRef.current = null;
      }
      const vp = viewportRef.current;
      setGraphViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
    };
    window.addEventListener('arcforge:flushViewport', flush);
    return () => window.removeEventListener('arcforge:flushViewport', flush);
  }, [setGraphViewport]);

  const layoutInput = useMemo(
    () => (graph.nodes.length > 0 ? getGraphLayoutInput(graph, projectPath) : null),
    [graph, projectPath]
  );

  React.useEffect(() => {
    if (!layoutInput) return;
    // Don't start the layout worker until positions are resolved from config.
    if (!positionsReady) return;
    // Skip worker when we have full saved coverage — avoids recalculating layout on edge add/remove.
    const skipWorker = hasFullPositionCoverage(layoutInput.nodes, graphNodePositions);
    if (skipWorker) return;
    if (!layoutWorkerRef.current) layoutWorkerRef.current = createLayoutWorker();
    const w = layoutWorkerRef.current;
    const requestId = ++layoutRequestIdRef.current;
    const existing = graphNodePositions ?? undefined;
    w.postMessage({
      requestId,
      nodes: layoutInput.nodes,
      edges: layoutInput.effectiveEdges,
      projectPath,
      existingPositions: existing ?? undefined,
      measuredSizesById: undefined,
    });
    const onMessage = (e: MessageEvent<{ requestId: number; positions: LayoutPositions }>) => {
      if (e.data.requestId !== layoutRequestIdRef.current) return;
      setWorkerLayoutPositions(e.data.positions);
    };
    w.addEventListener('message', onMessage);
    return () => w.removeEventListener('message', onMessage);
  }, [layoutInput, positionsReady, graphNodePositions, projectPath, adapterId]);

  React.useEffect(() => () => {
    if (layoutWorkerRef.current) {
      layoutWorkerRef.current.terminate();
      layoutWorkerRef.current = null;
    }
  }, []);

  const pluginTypeOrder = activePluginInfo?.nodeTypes?.map((nt) => nt.id);

  const layoutResult = useMemo(() => {
    const hasSaved = !!graphNodePositions && Object.keys(graphNodePositions).length > 0;
    const existing = hasSaved ? graphNodePositions : (graphUpdateFromForge ? graphNodePositions : null);
    return graphToFlow(graph, projectPath, existing, undefined, workerLayoutPositions, adapterId, pluginTypeOrder);
  }, [graph, projectPath, graphNodePositions, graphUpdateFromForge, workerLayoutPositions, pluginTypeOrder]);
  const initialNodes = useMemo(
    () => applySavedPositions(layoutResult.nodes, graphNodePositions),
    [layoutResult.nodes, graphNodePositions]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutResult.edges);

  // ---------------------------------------------------------------------------
  // Two-pass layout (Variant B): when there is NO .arcforge (positions empty),
  // run one additional layout after React Flow measures real node sizes.
  // ---------------------------------------------------------------------------
  React.useEffect(() => {
    if (!projectPath) return;
    // Wait until the config load has resolved before running auto-layout.
    // This prevents overwriting user-saved positions when graph:updated arrives
    // before loadArcforgeConfig completes.
    if (!positionsReady) return;
    const hasSavedPositions = !!graphNodePositions && Object.keys(graphNodePositions).length > 0;
    if (hasSavedPositions) return;
    if (didMeasuredLayoutRef.current) return;
    if (!nodes || nodes.length === 0) return;

    const measurables = nodes.filter((n) => n.id !== ENTRY_ID);
    if (measurables.length === 0) return;

    const getWH = (n: Node): { w: number; h: number } | null => {
      const w = (n.width ?? (n as unknown as { measured?: { width?: number } }).measured?.width) as number | undefined;
      const h = (n.height ?? (n as unknown as { measured?: { height?: number } }).measured?.height) as number | undefined;
      if (typeof w !== 'number' || typeof h !== 'number') return null;
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return { w, h };
    };

    const sized = measurables.filter((n) => getWH(n) != null);
    const ratio = sized.length / measurables.length;
    if (ratio < 0.7) return;

    const measured: MeasuredNodeSizesById = {};
    for (const n of sized) {
      const wh = getWH(n);
      if (!wh) continue;
      measured[n.id] = { w: wh.w, h: wh.h };
    }

    // Prevent loops before we set state (effect will re-run on nodes update)
    didMeasuredLayoutRef.current = true;

    const { nodes: n2, edges: e2 } = graphToFlow(graph, projectPath, null, measured, null, adapterId, pluginTypeOrder);
    setNodes((currentNodes) => {
      const selectedById = new Map(currentNodes.map((nd) => [nd.id, nd.selected]));
      return n2.map((nd) => ({
        ...nd,
        selected: selectedById.get(nd.id) ?? nd.selected,
      }));
    });
    setEdges(e2);

    // Persist initial positions to .arcforge so future updates are incremental.
    const nextPositions: GraphNodePositions = {};
    for (const n of n2) {
      nextPositions[n.id] = n.position;
      const sk = getStablePositionKey(n);
      if (sk) nextPositions[sk] = n.position;
    }
    setGraphNodePositions(nextPositions);

    // With no saved viewport, refit once after measured layout so first open looks clean.
    if (!graphViewport) {
      requestAnimationFrame(() => {
        rfInstance.fitView({ padding: 0.18, duration: 0 });
      });
    }
  }, [projectPath, positionsReady, graph, nodes, graphNodePositions, setGraphNodePositions, setNodes, setEdges, rfInstance, graphViewport]);

  // Minimap is expensive on very large graphs (renders all nodes).
  const shouldShowMinimap = minimapVisible && nodes.length <= 450 && edges.length <= 900;

  // On graph update (e.g. after add/remove connection), re-run layout and
  // apply saved positions from the store. Preserve selection from current
  // nodes so mass-drag selection is not lost when this effect runs.
  React.useEffect(() => {
    const fromForge = useGraphStore.getState().graphUpdateFromForge;
    const hasSaved = !!graphNodePositions && Object.keys(graphNodePositions).length > 0;
    const existing = hasSaved ? graphNodePositions : (fromForge ? graphNodePositions : null);
    const { nodes: n, edges: e } = graphToFlow(graph, projectPath, existing, undefined, workerLayoutPositions, adapterId, pluginTypeOrder);
    if (fromForge) useGraphStore.getState().clearGraphUpdateFromForge();
    const withPositions = applySavedPositions(n, graphNodePositions);
    setNodes((currentNodes) => {
      const selectedById = new Map(currentNodes.map((nd) => [nd.id, nd.selected]));
      return withPositions.map((nd) => ({
        ...nd,
        selected: selectedById.get(nd.id) ?? nd.selected,
      }));
    });
    setEdges(e);
  }, [graph, projectPath, graphNodePositions, workerLayoutPositions, setNodes, setEdges]);

  const handlePaneClick = React.useCallback(() => {
    marqueeSelectionRef.current = null;
  }, []);

  const handlePaneContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Allow adding nodes only for arcspec or if plugin capabilities allow it
      const caps = activePluginInfo?.capabilities;
      const canAdd = caps ? caps.addNodes : adapterId === 'arcspec';
      if (!canAdd) return;
      setContextMenu(null);
      setEdgeContextMenu(null);
      const flowPosition = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setPaneContextMenu({
        x: e.clientX,
        y: e.clientY,
        flowPosition,
      });
    },
    [adapterId, rfInstance, activePluginInfo]
  );

  const handleNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      marqueeSelectionRef.current = null;

      const caps = activePluginInfo?.capabilities;
      const data = node.data as { filePath?: string; nodeType?: string; metadata?: { line?: number } };

      // For user plugins, delegate to plugin:onNodeClick which may return language/scrollTo
      if (window.arcforge?.plugins?.onNodeClick) {
        window.arcforge.plugins.onNodeClick({
          id: node.id,
          type: data?.nodeType ?? node.type ?? '',
          filePath: data?.filePath,
          data: data as Record<string, unknown>,
        }).then((res) => {
          if (!res?.ok || !res.result) return;
          const { filePath: fp, scrollTo } = res.result as { filePath: string; language?: string; scrollTo?: number };
          if (fp && onOpenFile) {
            onOpenFile(fp, scrollTo != null ? { scrollToLine: scrollTo } : undefined);
          }
        }).catch(() => {
          // Fallback to default behavior
          const filePath = data?.filePath;
          if (typeof filePath !== 'string' || !filePath.trim() || !onOpenFile) return;
          const line = data.metadata?.line;
          onOpenFile(filePath.trim(), line != null ? { scrollToLine: line } : undefined);
        });
        return;
      }

      // Capabilities guard: skip file opening if openFileOnNodeClick is disabled
      if (caps && caps.openFileOnNodeClick === false) return;

      const filePath = data?.filePath;
      if (typeof filePath !== 'string' || !filePath.trim() || !onOpenFile) return;
      const line = data.metadata?.line != null ? data.metadata.line : undefined;
      onOpenFile(filePath.trim(), line != null ? { scrollToLine: line } : undefined);
    },
    [onOpenFile, activePluginInfo]
  );

  const handleNodeDragStop = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      const prev = useGraphStore.getState().graphNodePositions;
      const allNodes = rfInstance.getNodes();
      const selectedNodes = allNodes.filter((n) => n.selected);
      const toSave = selectedNodes.length > 0 ? selectedNodes : [node];
      const next: Record<string, { x: number; y: number }> = { ...(prev ?? {}) };
      for (const n of toSave) {
        next[n.id] = n.position;
        const sk = getStablePositionKey(n);
        if (sk) next[sk] = n.position;
      }
      setGraphNodePositions(next);
      const ids = marqueeSelectionRef.current;
      if (ids && ids.size > 0) {
        setNodes((ns) =>
          ns.map((n) => ({
            ...n,
            selected: ids.has(n.id) || n.selected,
          })),
        );
      }
    },
    [rfInstance, setGraphNodePositions, setNodes]
  );

  // Context menu (right-click on node)
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    /** When multiple nodes are selected, ids of all selected (for bulk delete). */
    selectedIds?: string[];
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = React.useState<{
    x: number;
    y: number;
    edgeId: string;
    originalEdgeIds?: string[];
  } | null>(null);
  const [paneContextMenu, setPaneContextMenu] = React.useState<{
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null>(null);
  const [edgeTooltip, setEdgeTooltip] = React.useState<{ x: number; y: number; label: string } | null>(null);
  const [deleteModalNode, setDeleteModalNode] = React.useState<{
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    selectedIds?: string[];
    isBulk?: boolean;
  } | null>(null);
  const [renameModal, setRenameModal] = React.useState<{ nodeId: string; currentLabel: string } | null>(null);
  const [exportArchModal, setExportArchModal] = React.useState<{ entryLabel: string; pluginPrompt?: string } | null>(null);
  const [alertMessage, setAlertMessage] = React.useState<string | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const edgeContextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const paneContextMenuRef = React.useRef<HTMLDivElement | null>(null);

  const handleNodeContextMenu = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      _.preventDefault();
      setEdgeContextMenu(null);
      const data = node.data as { label?: string; nodeType?: string };
      const nodeType = data?.nodeType ?? '';
      // Check both built-in deletable types and plugin capabilities
      const caps = activePluginInfo?.capabilities;
      const canDelete = caps ? caps.deleteNodes : DELETABLE_NODE_TYPES.has(nodeType);
      if (!canDelete && !DELETABLE_NODE_TYPES.has(nodeType)) return;

      // If multiple nodes are selected and this node is among them, treat as bulk selection.
      const allNodes = rfInstance.getNodes();
      const selected = allNodes.filter(
        (n) =>
          n.selected &&
          DELETABLE_NODE_TYPES.has(
            ((n.data as { nodeType?: string } | undefined)?.nodeType ?? n.type) as string,
          ),
      );
      const isMulti = node.selected && selected.length > 1;
      const selectedIds = isMulti ? selected.map((n) => n.id) : undefined;

      setContextMenu({
        x: _.clientX,
        y: _.clientY,
        nodeId: node.id,
        nodeLabel: isMulti ? `${selected.length} selected nodes` : data?.label ?? node.id,
        nodeType,
        selectedIds,
      });
    },
    [rfInstance],
  );

  const handleEdgeContextMenu = React.useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      _.preventDefault();
      setContextMenu(null);
      // Check if plugin allows deleting edges
      const caps = activePluginInfo?.capabilities;
      if (caps && caps.deleteEdges === false) return;
      const data = edge.data as { originalEdgeIds?: string[] } | undefined;
      const menuPayload = {
        x: _.clientX,
        y: _.clientY,
        edgeId: edge.id,
        ...(data?.originalEdgeIds?.length ? { originalEdgeIds: data.originalEdgeIds } : {}),
      };
      setEdgeContextMenu(menuPayload);
    },
    [adapterId, activePluginInfo]
  );

  const handleEdgeMouseMove = React.useCallback((e: React.MouseEvent, edge: Edge) => {
    const label = (edge as { label?: string }).label;
    if (!label) {
      setEdgeTooltip(null);
      return;
    }
    setEdgeTooltip({
      x: e.clientX + 10,
      y: e.clientY + 10,
      label: String(label),
    });
  }, []);

  const handleEdgeMouseLeave = React.useCallback(() => {
    setEdgeTooltip(null);
  }, []);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    setEdgeContextMenu(null);
    setPaneContextMenu(null);
  }, []);

  const handleAddEntryClick = React.useCallback(async () => {
    if (!paneContextMenu || !window.arcforge?.graph?.addNode) return;
    const { flowPosition } = paneContextMenu;
    setPaneContextMenu(null);
    const res = await window.arcforge.graph.addNode({
      type: 'arch_entry',
      label: 'Entry',
      position: flowPosition,
    });
    if (!res.ok && res.error) setAlertMessage(res.error);
    else if (res.ok && res.nodeId) {
      const prev = useGraphStore.getState().graphNodePositions;
      setGraphNodePositions({ ...(prev ?? {}), [res.nodeId]: flowPosition });
    }
  }, [paneContextMenu, setGraphNodePositions]);

  const handleDeleteClick = React.useCallback(() => {
    if (!contextMenu) return;
    const isBulk = !!contextMenu.selectedIds && contextMenu.selectedIds.length > 1;
      setDeleteModalNode({
        nodeId: contextMenu.nodeId,
        nodeLabel: contextMenu.nodeLabel,
        nodeType: contextMenu.nodeType,
        selectedIds: contextMenu.selectedIds,
      isBulk,
    });
    setContextMenu(null);
  }, [contextMenu]);

  const handleRenameClick = React.useCallback(() => {
    if (!contextMenu || adapterId !== 'arcspec') return;
    setRenameModal({ nodeId: contextMenu.nodeId, currentLabel: contextMenu.nodeLabel });
    setContextMenu(null);
  }, [contextMenu, adapterId]);

  const handleExportArchitectureClick = React.useCallback(async () => {
    if (!contextMenu) return;
    const caps = activePluginInfo?.capabilities;
    const canExport = caps ? caps.exportPrompt : adapterId === 'arcspec';
    if (!canExport) return;

    // For user plugins with onExport: delegate to plugin
    if (adapterId !== 'arcspec' && window.arcforge?.plugins?.onExport) {
      const res = await window.arcforge.plugins.onExport();
      if (res?.ok && res.prompt) {
        // Show prompt in PromptModal by temporarily storing in state
        setExportArchModal({ entryLabel: contextMenu.nodeLabel, pluginPrompt: res.prompt });
        setContextMenu(null);
        return;
      }
    }

    setExportArchModal({ entryLabel: contextMenu.nodeLabel });
    setContextMenu(null);
  }, [contextMenu, adapterId, activePluginInfo]);

  const closeFile = useGraphStore((s) => s.closeFile);

  const handleDeleteConfirm = React.useCallback(
    async (mode: DeleteMode) => {
      if (!deleteModalNode || !window.arcforge?.graph?.deleteNode) return;
      const ids =
        deleteModalNode.selectedIds && deleteModalNode.selectedIds.length > 0
          ? deleteModalNode.selectedIds
          : [deleteModalNode.nodeId];

      const store = useGraphStore.getState();
      const projectPath = store.projectPath;

      const deletedFiles = new Set<string>();
      for (const id of ids) {
        const res = await window.arcforge.graph.deleteNode(id, mode);
        if (!res.ok && res.error) {
          const msg = res.error.includes('Supported:')
            ? res.error.replace(/\s*Supported:.*/s, '').trim() || res.error
            : res.error;
          setAlertMessage(msg);
          setDeleteModalNode(null);
          return;
        }
        if (res.deleted?.length) {
          for (const path of res.deleted) deletedFiles.add(path);
        }
      }
      setDeleteModalNode(null);
      // Auto-close tabs for deleted files
      if (deletedFiles.size) {
        for (const path of deletedFiles) closeFile(path);
      }
      // Refresh open, clean files so route/controller tabs reflect code cleanup
      if (!projectPath || !window.arcforge?.fs) return;
      for (const path of store.openFilePaths) {
        if (store.fileDirty[path]) continue;
        const readRes = await window.arcforge.fs.readFile(projectPath, path);
        if (readRes.ok && readRes.content !== null) {
          store.openFile(path, readRes.content, { activate: false });
        }
      }
      // Refresh file explorer so deleted files (e.g. FormRequest) disappear immediately
      store.setExplorerRefreshTrigger();
    },
    [deleteModalNode, closeFile]
  );

  const isValidConnection = React.useCallback(
    (connection: Connection) => {
      // Capabilities guard
      const caps = activePluginInfo?.capabilities;
      if (caps && caps.addEdges === false) return false;
      if (!connection.source || !connection.target) return false;
      const allNodes = rfInstance.getNodes();
      const sourceNode = allNodes.find((n) => n.id === connection.source);
      const targetNode = allNodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceType = (sourceNode.data as { nodeType?: string })?.nodeType ?? '';
      const targetType = (targetNode.data as { nodeType?: string })?.nodeType ?? '';
      return isConnectionAllowed(sourceType, targetType, adapterId ?? undefined);
    },
    [rfInstance, adapterId, activePluginInfo]
  );

  const handleConnect = React.useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || !window.arcforge?.graph?.addConnection) return;
      // Flush current node positions before add — prevents nodes from shifting when graph updates.
      const currentNodes = rfInstance.getNodes();
      if (currentNodes.length > 0) {
        const prev = useGraphStore.getState().graphNodePositions;
        const next: Record<string, { x: number; y: number }> = { ...(prev ?? {}) };
        for (const n of currentNodes) {
          next[n.id] = n.position;
          const sk = getStablePositionKey(n);
          if (sk) next[sk] = n.position;
        }
        setGraphNodePositions(next);
      }
      const res = await window.arcforge.graph.addConnection({
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? null,
        target: connection.target,
        targetHandle: connection.targetHandle ?? null,
      });
      if (!res.ok && res.error) setAlertMessage(res.error);
    },
    [rfInstance, setGraphNodePositions]
  );

  const handleRemoveConnectionClick = React.useCallback(async () => {
    if (!edgeContextMenu || !window.arcforge?.graph?.deleteEdge) return;
    // Flush current node positions to store before delete — prevents nodes from shifting when graph updates.
    const currentNodes = rfInstance.getNodes();
    if (currentNodes.length > 0) {
      const prev = useGraphStore.getState().graphNodePositions;
      const next: Record<string, { x: number; y: number }> = { ...(prev ?? {}) };
      for (const n of currentNodes) {
        next[n.id] = n.position;
        const sk = getStablePositionKey(n);
        if (sk) next[sk] = n.position;
      }
      setGraphNodePositions(next);
    }
    const ids = edgeContextMenu.originalEdgeIds?.length
      ? edgeContextMenu.originalEdgeIds
      : [edgeContextMenu.edgeId];
    setEdgeContextMenu(null);
    for (const id of ids) {
      const res = await window.arcforge.graph.deleteEdge(id);
      if (!res.ok && res.error) {
        setAlertMessage(res.error);
        break;
      }
    }
  }, [edgeContextMenu, rfInstance, setGraphNodePositions]);

  // Close context menu when clicking outside
  React.useEffect(() => {
    if (!contextMenu && !edgeContextMenu && !paneContextMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as unknown as globalThis.Node | null;
      if (target && contextMenuRef.current?.contains(target)) return;
      if (target && edgeContextMenuRef.current?.contains(target)) return;
      if (target && paneContextMenuRef.current?.contains(target)) return;
      closeContextMenu();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [contextMenu, edgeContextMenu, paneContextMenu, closeContextMenu]);

  // ---------------------------------------------------------------------------
  // Right-button drag selection (marquee) for multi-selecting nodes
  // Uses capture-phase listener because React Flow may not expose onPaneMouseDown.
  // panOnDrag={[1]} disables right-drag pan so our selection can work.
  // ---------------------------------------------------------------------------

  const [rmbSelection, setRmbSelection] = React.useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    active: boolean;
  } | null>(null);

  // When marquee selection completes, prevent context menu from opening (all adapters).
  const rmbMarqueeJustCompletedRef = React.useRef(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleDown = (e: MouseEvent) => {
      if (e.button !== 2) return;
      // Skip if clicking on a node, edge, control, or minimap (let context menu work there)
      const target = e.target as HTMLElement;
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__minimap')
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY };
      setRmbSelection({ start, end: start, active: true });

      const handleMove = (ev: MouseEvent) => {
        setRmbSelection((prev) => (prev ? { ...prev, end: { x: ev.clientX, y: ev.clientY } } : prev));
      };

      const handleUp = (ev: MouseEvent) => {
        setRmbSelection((prev) => {
          if (!prev) return null;
          const end = { x: ev.clientX, y: ev.clientY };
          const dx = end.x - prev.start.x;
          const dy = end.y - prev.start.y;
          const movedEnough = Math.hypot(dx, dy) > 4;

          if (movedEnough) {
            rmbMarqueeJustCompletedRef.current = true;
            setTimeout(() => {
              rmbMarqueeJustCompletedRef.current = false;
            }, 150);
            const startFlow = rfInstance.screenToFlowPosition(prev.start);
            const endFlow = rfInstance.screenToFlowPosition(end);
            const x1 = Math.min(startFlow.x, endFlow.x);
            const x2 = Math.max(startFlow.x, endFlow.x);
            const y1 = Math.min(startFlow.y, endFlow.y);
            const y2 = Math.max(startFlow.y, endFlow.y);

            const toSelect = new Set(
              rfInstance
                .getNodes()
                .filter((n) => {
                  const nx = (n.positionAbsolute?.x ?? n.position.x) ?? 0;
                  const ny = (n.positionAbsolute?.y ?? n.position.y) ?? 0;
                  const w = n.width ?? 0;
                  const h = n.height ?? 0;
                  return (
                    nx + w >= x1 && nx <= x2 && ny + h >= y1 && ny <= y2
                  );
                })
                .map((n) => n.id),
            );

            marqueeSelectionRef.current = toSelect.size > 0 ? toSelect : null;
            setNodes((ns) =>
              ns.map((n) => ({
                ...n,
                selected: toSelect.has(n.id),
              })),
            );
          }
          return null;
        });
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp, { once: true });
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (rmbMarqueeJustCompletedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        rmbMarqueeJustCompletedRef.current = false;
      }
    };

    el.addEventListener('mousedown', handleDown, { capture: true });
    el.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => {
      el.removeEventListener('mousedown', handleDown, { capture: true });
      el.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [rfInstance, setNodes]);

  const selectedCount = nodes.filter((n) => n.selected).length;

  // Compute selection rectangle coordinates relative to container
  let selectionStyle: React.CSSProperties | undefined;
  if (rmbSelection && rmbSelection.active && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    const x1 = Math.min(rmbSelection.start.x, rmbSelection.end.x) - rect.left;
    const x2 = Math.max(rmbSelection.start.x, rmbSelection.end.x) - rect.left;
    const y1 = Math.min(rmbSelection.start.y, rmbSelection.end.y) - rect.top;
    const y2 = Math.max(rmbSelection.start.y, rmbSelection.end.y) - rect.top;
    selectionStyle = {
      left: x1,
      top: y1,
      width: Math.max(0, x2 - x1),
      height: Math.max(0, y2 - y1),
    };
  }

  return (
    <div
      ref={containerRef}
      className="arcforge-graph-wrap"
      {...(selectedCount >= 2 && { 'data-multi-select': '' })}
      style={{ height: '100%', background: 'var(--arc-bg)', position: 'relative' }}
    >
<ForgeModal onDone={onForgeDone} />
      {deleteModalNode && (
        <DeleteConfirmModal
          nodeId={deleteModalNode.nodeId}
          nodeLabel={deleteModalNode.nodeLabel}
          nodeType={deleteModalNode.nodeType}
          isBulk={deleteModalNode.isBulk}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModalNode(null)}
        />
      )}
      {renameModal && (
        <PromptModal
          title="Rename node"
          placeholder="New name"
          defaultValue={renameModal.currentLabel}
          confirmLabel="Rename"
          onConfirm={async (value) => {
            setRenameModal(null);
            if (!window.arcforge?.graph?.renameNode) return;
            const res = await window.arcforge.graph.renameNode(renameModal.nodeId, value);
            if (!res.ok && res.error) setAlertMessage(res.error);
          }}
          onCancel={() => setRenameModal(null)}
        />
      )}
      {alertMessage && (
        <AlertModal
          title="arcforge"
          message={alertMessage}
          onClose={() => setAlertMessage(null)}
        />
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="arcforge-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {(() => {
            const caps = activePluginInfo?.capabilities;
            const canExport = caps ? caps.exportPrompt : adapterId === 'arcspec';
            const isArcspecEntry = adapterId === 'arcspec' && contextMenu.nodeType === 'arch_entry' && graph.edges.some((e) => e.from === contextMenu.nodeId);
            return (canExport && (isArcspecEntry || adapterId !== 'arcspec')) ? (
              <button
                type="button"
                className="arcforge-context-menu-item"
                onClick={handleExportArchitectureClick}
              >
                Export Prompt
              </button>
            ) : null;
          })()}
          {adapterId === 'arcspec' && (!contextMenu.selectedIds || contextMenu.selectedIds.length <= 1) && (
            <button type="button" className="arcforge-context-menu-item" onClick={handleRenameClick}>
              Rename…
            </button>
          )}
          {(() => {
            const caps = activePluginInfo?.capabilities;
            const canDelete = caps ? caps.deleteNodes : true;
            const isDefaultEntry = contextMenu.nodeId === 'arch:entry';
            return canDelete && !isDefaultEntry ? (
              <button type="button" className="arcforge-context-menu-item" onClick={handleDeleteClick}>
                Delete…
              </button>
            ) : null;
          })()}
        </div>
      )}
      {exportArchModal && (
        <ExportArchitectureModal
          graph={graph}
          entryLabel={exportArchModal.entryLabel}
          overrideContent={exportArchModal.pluginPrompt}
          onClose={() => setExportArchModal(null)}
        />
      )}
      {edgeContextMenu && (
        <div
          ref={edgeContextMenuRef}
          className="arcforge-context-menu"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
        >
          <button type="button" className="arcforge-context-menu-item" onClick={handleRemoveConnectionClick}>
            Delete
          </button>
        </div>
      )}
      {paneContextMenu && (
        <div
          ref={paneContextMenuRef}
          className="arcforge-context-menu"
          style={{ left: paneContextMenu.x, top: paneContextMenu.y }}
        >
          <button type="button" className="arcforge-context-menu-item" onClick={handleAddEntryClick}>
            Add Entry
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        isValidConnection={isValidConnection}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onEdgeMouseMove={handleEdgeMouseMove}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        onNodeDragStop={handleNodeDragStop}
        panOnDrag={[0, 1]}
        onPaneContextMenu={handlePaneContextMenu}
        onInit={handleInit}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
        defaultViewport={graphViewport ?? { x: 0, y: 0, zoom: 1 }}
        attributionPosition="bottom-left"
        minZoom={0.05}
        maxZoom={4}
        onlyRenderVisibleElements={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="transparent" gap={16} />
        {controlsVisible && <Controls />}
        {shouldShowMinimap && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              const nt = (n.data as { nodeType?: string }).nodeType ?? '';
              if (nt === 'entry') return '#334155';
              return (NODE_COLORS as Record<string, { bg: string }>)[nt]?.bg ?? '#6b7280';
            }}
            maskColor="rgba(0,0,0,0.7)"
          />
        )}
      </ReactFlow>
      {edgeTooltip && (
        <div
          className="arcforge-edge-tooltip"
          style={{ left: edgeTooltip.x, top: edgeTooltip.y }}
        >
          {edgeTooltip.label}
        </div>
      )}
      {selectionStyle && (
        <div className="arcforge-graph-selection" style={selectionStyle} />
      )}
      {showAnalysisStatus && analysisStatusText && (
        <div className="arcforge-graph-status">
          <div className="arcforge-titlebar-status" title={analysisStatusText}>
            <span className="arcforge-titlebar-status-dot" aria-hidden />
            <span className="arcforge-titlebar-status-text">{analysisStatusText}</span>
          </div>
        </div>
      )}
    </div>
  );
};
