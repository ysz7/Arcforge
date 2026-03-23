/**
 * Tree layout via Dagre — correct Laravel request flow:
 *
 *   App → Routes → Controllers → Services → Models
 *
 * Routes are the entry points (HTTP endpoints).
 * Controllers are called by routes.
 * Services are injected into controllers.
 * Models are used by services/controllers.
 */

import * as dagre from 'dagre';
import type { Node, Edge } from 'reactflow';

const NODE_SIZES: Record<string, { w: number; h: number }> = {
  entry: { w: 120, h: 44 },
  cli: { w: 100, h: 40 },
  entity: { w: 160, h: 52 },
  domain_entity: { w: 160, h: 52 },
  domain_interface: { w: 160, h: 44 },
  application_service: { w: 280, h: 120 },
  infrastructure_repository: { w: 200, h: 120 },
  route_resource: { w: 100, h: 40 },
  route_group: { w: 140, h: 40 },
  route: { w: 180, h: 44 },
  route_cluster: { w: 320, h: 300 },
  controller: { w: 280, h: 120 },
  service: { w: 280, h: 120 },
  model: { w: 180, h: 100 },
  repository: { w: 200, h: 120 },
  interface: { w: 160, h: 44 },
  migration_group: { w: 180, h: 40 },
  migration: { w: 200, h: 72 },
  seeder: { w: 140, h: 44 },
  policy: { w: 160, h: 52 },
  observer: { w: 160, h: 52 },
  resource: { w: 180, h: 52 },
  middleware: { w: 160, h: 52 },
  job: { w: 160, h: 52 },
  event: { w: 160, h: 52 },
  listener: { w: 160, h: 52 },
  command: { w: 160, h: 52 },
  form_request: { w: 180, h: 52 },
  database: { w: 170, h: 56 },
  // Architecture nodes
  arch_entry: { w: 140, h: 48 },
  arch_entry_interface: { w: 160, h: 48 },
  arch_bounded_context: { w: 160, h: 48 },
  arch_application_service: { w: 160, h: 48 },
  arch_domain_event: { w: 140, h: 44 },
  arch_controller: { w: 180, h: 52 },
  arch_service: { w: 160, h: 52 },
  arch_model: { w: 140, h: 48 },
  arch_repository: { w: 180, h: 52 },
  arch_repository_interface: { w: 180, h: 48 },
  arch_middleware: { w: 160, h: 48 },
  arch_router: { w: 120, h: 44 },
  arch_form_request: { w: 180, h: 48 },
  arch_resource: { w: 160, h: 48 },
  arch_response: { w: 140, h: 44 },
  arch_view: { w: 140, h: 44 },
  arch_event: { w: 140, h: 44 },
  arch_listener: { w: 140, h: 44 },
  arch_job: { w: 160, h: 48 },
  arch_database: { w: 140, h: 44 },
  arch_eloquent: { w: 140, h: 48 },
  arch_orm: { w: 140, h: 48 },
  arch_migration: { w: 140, h: 48 },
  arch_seeder: { w: 140, h: 48 },
  arch_factory: { w: 140, h: 48 },
  arch_di_container: { w: 140, h: 48 },
};

const DEFAULT_SIZE = { w: 180, h: 52 };

function getNodeType(node: Node): string {
  return (node.data as { nodeType?: string })?.nodeType ?? '';
}

function getNodeSize(nt: string): { w: number; h: number } {
  return NODE_SIZES[nt] ?? DEFAULT_SIZE;
}

export type ExistingPositions = Record<string, { x: number; y: number }> | null;
export type MeasuredNodeSizesById = Record<string, { w: number; h: number }> | null;

export type LayoutPositions = Record<string, { x: number; y: number }>;

/** Architecture layout: Dagre LR with arch_dependency edges, minimizes crossings. */
function computeArchitectureLayout(
  nodes: Node[],
  edges: Edge[],
  getNodeType: (n: Node) => string,
  getNodeSize: (nt: string) => { w: number; h: number },
  nodeMap: Map<string, Node>,
  rootId: string
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    ranker: 'network-simplex',
    ranksep: 80,
    nodesep: 50,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  for (const n of nodes) {
    const nt = getNodeType(n);
    const { w, h } = getNodeSize(nt);
    g.setNode(n.id, { width: w, height: h });
  }

  for (const e of edges) {
    const cls = (e as { className?: string }).className ?? (e as { type?: string }).type ?? '';
    if (cls !== 'arch_dependency') continue;
    if (!g.hasNode(e.source) || !g.hasNode(e.target)) continue;
    if (e.source === e.target) continue;
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const pos = g.node(n.id);
    if (pos) {
      const { w, h } = getNodeSize(getNodeType(n));
      positions.set(n.id, { x: pos.x - w / 2, y: pos.y - h / 2 });
    }
  }
  return positions;
}

/**
 * Runs layout (dagre + CLI block) in a separate thread. Returns only positions
 * so the result can be transferred from a Web Worker without cloning full nodes.
 */
export function getLayoutPositions(
  nodes: Node[],
  edges: Edge[],
  projectPath?: string | null,
  existingPositions?: ExistingPositions,
  measuredSizesById?: MeasuredNodeSizesById
): LayoutPositions {
  const map = computeLayoutPositionsMap(nodes, edges, projectPath, existingPositions, measuredSizesById);
  return Object.fromEntries(map);
}

function computeLayoutPositionsMap(
  nodes: Node[],
  edges: Edge[],
  projectPath?: string | null,
  existingPositions?: ExistingPositions,
  measuredSizesById?: MeasuredNodeSizesById
): Map<string, { x: number; y: number }> {
  const entryId = '__arcforge_entry__';
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Architecture graphs: use Dagre with arch_entry root and arch_dependency edges
  const archEntry = nodes.find((n) => getNodeType(n) === 'arch_entry');
  if (archEntry && nodes.some((n) => getNodeType(n).startsWith('arch_'))) {
    return computeArchitectureLayout(nodes, edges, getNodeType, getNodeSize, nodeMap, archEntry.id);
  }

  const getMeasuredSize = (id: string, fallback: { w: number; h: number }) => {
    const m = measuredSizesById?.[id];
    if (!m) return fallback;
    const w = Number(m.w);
    const h = Number(m.h);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return fallback;
    return {
      w: Math.max(60, Math.min(720, w)),
      h: Math.max(30, Math.min(720, h)),
    };
  };

  // Classify nodes by type
  const controllers: string[] = [];
  const services: string[] = [];
  const models: string[] = [];
  const repositories: string[] = [];
  const interfaces: string[] = [];
  const entities: string[] = [];
  const routes: string[] = [];
  const routeGroups: string[] = [];
  const routeResources: string[] = [];
  const migrations: string[] = [];
  const migrationGroups: string[] = [];
  const seeders: string[] = [];
  const commands: string[] = [];

  for (const n of nodes) {
    switch (getNodeType(n)) {
      case 'controller': controllers.push(n.id); break;
      case 'service': case 'application_service': services.push(n.id); break;
      case 'model': models.push(n.id); break;
      case 'repository': case 'infrastructure_repository': repositories.push(n.id); break;
      case 'interface': case 'domain_interface': interfaces.push(n.id); break;
      case 'entity': case 'domain_entity': entities.push(n.id); break;
      case 'route':
      case 'route_cluster':
        routes.push(n.id); break;
      case 'route_group': routeGroups.push(n.id); break;
      case 'route_resource': routeResources.push(n.id); break;
      case 'migration': migrations.push(n.id); break;
      case 'migration_group': migrationGroups.push(n.id); break;
      case 'seeder': seeders.push(n.id); break;
      case 'command': commands.push(n.id); break;
    }
  }

  // migration_group → migration (from graph edges)
  const migrationGroupToMigrations = new Map<string, string[]>();
  for (const e of edges) {
    if ((e as { className?: string }).className === 'migration_group') {
      const list = migrationGroupToMigrations.get(e.source) ?? [];
      list.push(e.target);
      migrationGroupToMigrations.set(e.source, list);
    }
  }

  // Group → route or group → resource (from route_group edges)
  // When prefix contains resource: group → resource; when prefix contains single routes: group → route
  const groupToRoutes = new Map<string, string[]>();
  const groupToResources = new Map<string, string[]>();
  const routesInGroup = new Set<string>();
  const resourcesInGroup = new Set<string>();
  const routeNodeIds = new Set(routes);
  const resourceNodeIds = new Set(routeResources);
  for (const e of edges) {
    if ((e as { className?: string }).className === 'route_group') {
      if (routeNodeIds.has(e.target)) {
        const list = groupToRoutes.get(e.source) ?? [];
        list.push(e.target);
        groupToRoutes.set(e.source, list);
        routesInGroup.add(e.target);
      } else if (resourceNodeIds.has(e.target)) {
        const list = groupToResources.get(e.source) ?? [];
        list.push(e.target);
        groupToResources.set(e.source, list);
        resourcesInGroup.add(e.target);
      }
    }
  }

  // Route resource (facade) → route (from route_resource edges)
  const resourceToRoutes = new Map<string, string[]>();
  const routesInResource = new Set<string>();
  for (const e of edges) {
    if ((e as { className?: string }).className === 'route_resource') {
      const list = resourceToRoutes.get(e.source) ?? [];
      list.push(e.target);
      resourceToRoutes.set(e.source, list);
      routesInResource.add(e.target);
    }
  }

  // Build dependency map (source → targets) — includes uses_form_request, listens_to
  const depTargets = new Map<string, string[]>();
  for (const e of edges) {
    const type = (e as { className?: string }).className;
    if (type === 'dependency' || type === 'uses_form_request' || type === 'listens_to') {
      const list = depTargets.get(e.source) ?? [];
      if (!list.includes(e.target)) list.push(e.target);
      depTargets.set(e.source, list);
    }
  }

  // Implements: class → interface
  const implementsTargets = new Map<string, string[]>();
  for (const e of edges) {
    if ((e as { className?: string }).className === 'implements') {
      const list = implementsTargets.get(e.source) ?? [];
      list.push(e.target);
      implementsTargets.set(e.source, list);
    }
  }

  // Method binding: controller → model (methods that use model as param)
  const methodBindingTargets = new Map<string, string[]>();
  for (const e of edges) {
    if ((e as { className?: string }).className === 'method_binding') {
      const list = methodBindingTargets.get(e.source) ?? [];
      if (!list.includes(e.target)) list.push(e.target);
      methodBindingTargets.set(e.source, list);
    }
  }

  // Build route_binding map (route/cluster → controller)
  const routeToController = new Map<string, string>();
  for (const e of edges) {
    if ((e as { className?: string }).className === 'route_binding') {
      const src = nodeMap.get(e.source);
      const st = src ? getNodeType(src) : '';
      if (src && (st === 'route' || st === 'route_cluster')) {
        routeToController.set(e.source, e.target);
      }
    }
  }

  // Build route → middleware map (uses_middleware)
  const routeToMiddlewares = new Map<string, string[]>();
  for (const e of edges) {
    if ((e as { className?: string }).className === 'uses_middleware') {
      const list = routeToMiddlewares.get(e.source) ?? [];
      if (!list.includes(e.target)) list.push(e.target);
      routeToMiddlewares.set(e.source, list);
    }
  }

  // Which controllers have routes pointing to them
  const controllersWithRoutes = new Set(routeToController.values());

  // --- Build Dagre tree (correct flow: App → Route → Controller → Service → Model) ---
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    ranker: 'tight-tree',
    ranksep: 120,
    nodesep: 40,
    marginx: 50,
    marginy: 50,
  });

  // Entry (synthetic node)
  g.setNode(entryId, { width: NODE_SIZES.entry.w, height: NODE_SIZES.entry.h });

  // Add only main flow nodes (CLI block is laid out separately)
  const isCliNode = (nt: string) => nt === 'migration' || nt === 'migration_group' || nt === 'seeder';
  for (const n of nodes) {
    const nt = getNodeType(n);
    if (isCliNode(nt)) continue;
    const fallback = getNodeSize(nt);
    const { w, h } = getMeasuredSize(n.id, fallback);
    g.setNode(n.id, { width: w, height: h });
  }

  // ---------------------------------------------------------------------------
  // Framework-agnostic TREE SKELETON for layout
  //
  // The real graph has many incoming edges (shared services/models), which causes
  // layered layouts to "push" nodes far right and form huge columns.
  // For layout we build a spanning arborescence (one parent per node) and then
  // render all edges on top.
  // ---------------------------------------------------------------------------

  const nodeTypeById = new Map<string, string>();
  nodeTypeById.set(entryId, 'entry');
  for (const n of nodes) nodeTypeById.set(n.id, getNodeType(n));

  const typeRank: Record<string, number> = {
    entry: 0,
    route_group: 10,
    route_resource: 12,
    route: 14,
    route_cluster: 14,
    controller: 20,
    form_request: 24,
    service: 30,
    application_service: 30,
    repository: 34,
    infrastructure_repository: 34,
    model: 40,
    interface: 50,
    domain_interface: 50,
    entity: 55,
    domain_entity: 55,
    middleware: 60,
    policy: 60,
    observer: 60,
    resource: 60,
    job: 60,
    event: 60,
    listener: 60,
    database: 70,
    command: 80,
    migration_group: 90,
    migration: 90,
    seeder: 90,
    cli: 95,
  };

  const rankOf = (id: string): number => typeRank[nodeTypeById.get(id) ?? ''] ?? 65;

  const basePriority: Record<string, number> = {
    entry_flow: 0,
    route_group: 6,
    route_resource: 7,
    route_binding: 10,
    dependency: 18,
    method_binding: 20,
    uses_form_request: 21,
    implements: 28,
    relationship: 80,
  };

  type Candidate = { from: string; to: string; cls: string; score: number };
  const incoming = new Map<string, Candidate[]>();

  const scoreEdge = (from: string, to: string, cls: string): number => {
    let s = basePriority[cls] ?? 60;
    const rf = rankOf(from);
    const rt = rankOf(to);
    if (from !== entryId && rf >= rt) s += 500; // discourage backwards edges for the tree
    s += Math.max(0, rt - rf) * 0.2;

    const tt = nodeTypeById.get(to) ?? '';
    if (tt === 'controller' && cls === 'route_binding') s -= 12;
    if ((tt === 'route' || tt === 'route_cluster') && (cls === 'route_group' || cls === 'route_resource' || cls === 'entry_flow')) s -= 6;
    if ((tt === 'service' || tt === 'application_service' || tt === 'repository' || tt === 'infrastructure_repository') && cls === 'dependency') s -= 5;
    if (tt === 'model' && (cls === 'dependency' || cls === 'method_binding')) s -= 8;
    if ((tt === 'interface' || tt === 'domain_interface') && cls === 'implements') s -= 14;
    if (tt === 'form_request' && (cls === 'uses_form_request' || cls === 'dependency')) s -= 6;
    return s;
  };

  const pushCandidate = (from: string, to: string, cls: string) => {
    if (to === entryId) return;
    if (from === to) return;
    if (!g.hasNode(from) || !g.hasNode(to)) return;
    if (isCliNode(nodeTypeById.get(from) ?? '') || isCliNode(nodeTypeById.get(to) ?? '')) return;
    const cand: Candidate = { from, to, cls, score: scoreEdge(from, to, cls) };
    const list = incoming.get(to) ?? [];
    list.push(cand);
    incoming.set(to, list);
  };

  // Candidates from actual graph edges (generic)
  const ALLOWED_TREE_EDGE_CLASSES = new Set([
    'route_group',
    'route_resource',
    'route_binding',
    'dependency',
    'method_binding',
    'uses_form_request',
    'implements',
  ]);
  for (const e of edges) {
    const cls = (e as { className?: string }).className ?? '';
    if (!ALLOWED_TREE_EDGE_CLASSES.has(cls)) continue;
    pushCandidate(e.source, e.target, cls);
  }

  // Prefer conventional entry points when routes exist
  for (const gid of routeGroups) pushCandidate(entryId, gid, 'entry_flow');
  for (const resid of routeResources) if (!resourcesInGroup.has(resid)) pushCandidate(entryId, resid, 'entry_flow');
  for (const rid of routes) if (!routesInGroup.has(rid) && !routesInResource.has(rid)) pushCandidate(entryId, rid, 'entry_flow');
  for (const cid of controllers) if (!controllersWithRoutes.has(cid)) pushCandidate(entryId, cid, 'entry_flow');

  // Pick ONE parent per node (best scored incoming). Fall back to entry.
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    const id = n.id;
    if (id === entryId) continue;
    if (!g.hasNode(id)) continue;
    const candidates = (incoming.get(id) ?? []).slice().sort((a, b) => a.score - b.score);
    const chosen = candidates.find((c) => c.from === entryId || rankOf(c.from) < rankOf(id));
    parentOf.set(id, chosen?.from ?? entryId);
  }

  for (const [child, parent] of parentOf) {
    if (g.hasNode(parent) && g.hasNode(child)) g.setEdge(parent, child);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  const ep = g.node(entryId);
  if (ep) {
    positions.set(entryId, { x: ep.x - NODE_SIZES.entry.w / 2, y: ep.y - NODE_SIZES.entry.h / 2 });
  }
  for (const n of nodes) {
    const nt = getNodeType(n);
    if (nt === 'migration' || nt === 'migration_group' || nt === 'seeder') continue; // placed in CLI block
    const pos = g.node(n.id);
    if (pos) {
      const fallback = getNodeSize(nt);
      const { w, h } = getMeasuredSize(n.id, fallback);
      positions.set(n.id, { x: pos.x - w / 2, y: pos.y - h / 2 });
    }
  }

  // --- CLI block: manual grid layout (left and below App) ---
  // Migration GROUPS: max 4 per column in height, then next column to the right.
  // Within each group: table nodes in grid, max 2 rows, flow right.
  const cliId = '__arcforge_cli__';

  const CLI_GAP = 100;
  const CLI_TO_GROUP_X = 100;  // generous gap: CLI node → first migration group
  const GROUP_TO_CHILD_X = 80; // gap: migration group node → first Schema::create (table) node
  const GROUP_GAP_Y = 50;
  const MIGRATION_GAP_X = 28;
  const MIGRATION_GAP_Y = 24;
  const MAX_ROWS = 2;         // max rows of table nodes per group
  const MAX_GROUP_ROWS = 4;   // max migration groups per column (height), then next column
  const SEEDER_GAP_X = 24;
  const MIGRATION_ROW_H = 100;
  // One "slot" height for a group block (2 rows of tables + gap)
  const GROUP_BLOCK_HEIGHT = 2 * MIGRATION_ROW_H + MIGRATION_GAP_Y + 40;
  const COL_GAP = 50; // gap from last node in column to next column

  const mgSize = getNodeSize('migration_group');
  const migSize = getNodeSize('migration');

  let mainMaxY = 0;
  let mainMinX = 0;
  for (const pos of positions.values()) {
    mainMaxY = Math.max(mainMaxY, pos.y + 80);
    mainMinX = Math.min(mainMinX, pos.x);
  }

  const cliX = mainMinX;
  const cliY = mainMaxY + CLI_GAP;
  const cliSize = NODE_SIZES.cli;
  positions.set(cliId, { x: cliX, y: cliY });

  const groupStartX = cliX + cliSize.w + CLI_TO_GROUP_X;
  const groupBaseY = cliY;

  // Compute start X of each column: where the last nested table node ends + COL_GAP
  const numColumns = Math.ceil(migrationGroups.length / MAX_GROUP_ROWS);
  const columnStartX: number[] = [groupStartX];

  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    let columnRight = columnStartX[colIndex];
    for (let rowIndex = 0; rowIndex < MAX_GROUP_ROWS; rowIndex++) {
      const index = colIndex * MAX_GROUP_ROWS + rowIndex;
      if (index >= migrationGroups.length) break;
      const mgid = migrationGroups[index];
      const childIds = migrationGroupToMigrations.get(mgid) ?? [];
      const groupX = columnStartX[colIndex];
      const numTableCols = Math.max(1, Math.ceil(childIds.length / MAX_ROWS));
      // Right edge of last table node in this group
      const lastTableRight = groupX + mgSize.w + GROUP_TO_CHILD_X
        + (numTableCols - 1) * (migSize.w + MIGRATION_GAP_X) + migSize.w;
      columnRight = Math.max(columnRight, lastTableRight);
    }
    columnStartX[colIndex + 1] = columnRight + COL_GAP;
  }

  migrationGroups.forEach((mgid, index) => {
    const childIds = migrationGroupToMigrations.get(mgid) ?? [];

    const colIndex = Math.floor(index / MAX_GROUP_ROWS);
    const rowIndex = index % MAX_GROUP_ROWS;
    const groupX = columnStartX[colIndex];
    const groupY = groupBaseY + rowIndex * GROUP_BLOCK_HEIGHT;

    positions.set(mgid, { x: groupX, y: groupY });

    const childStartX = groupX + mgSize.w + GROUP_TO_CHILD_X;
    const childStartY = groupY;

    for (let i = 0; i < childIds.length; i++) {
      const col = Math.floor(i / MAX_ROWS);
      const row = i % MAX_ROWS;
      const cx = childStartX + col * (migSize.w + MIGRATION_GAP_X);
      const cy = childStartY + row * (MIGRATION_ROW_H + MIGRATION_GAP_Y);
      positions.set(childIds[i], { x: cx, y: cy });
    }
  });

  // Seeders: horizontal row below the migration groups grid (2 rows of groups)
  const seederStartX = groupStartX;
  let seederCursorX = seederStartX;
  const seederY = groupBaseY + MAX_GROUP_ROWS * GROUP_BLOCK_HEIGHT + 30;
  const seederSize = getNodeSize('seeder');
  for (const sid of seeders) {
    positions.set(sid, { x: seederCursorX, y: seederY });
    seederCursorX += seederSize.w + SEEDER_GAP_X;
  }

  // Shift new nodes to the right of existing layout — only when called with existingPositions (e.g. from blueprint)
  const NEW_CHAIN_GAP = 200;
  if (existingPositions && Object.keys(existingPositions).length > 0) {
    let existingMaxX = -Infinity;
    const getW = (id: string) => {
      if (id === entryId) return NODE_SIZES.entry.w;
      if (id === cliId) return NODE_SIZES.cli.w;
      const n = nodeMap.get(id);
      const fallback = getNodeSize(getNodeType(n ?? ({} as Node)));
      return getMeasuredSize(id, fallback).w;
    };
    for (const [id, pos] of Object.entries(existingPositions)) {
      existingMaxX = Math.max(existingMaxX, pos.x + getW(id));
    }
    const newIds = new Set<string>();
    for (const n of nodes) {
      if (!(n.id in existingPositions)) newIds.add(n.id);
    }
    if (newIds.size > 0 && existingMaxX > -Infinity) {
      let newMinX = Infinity;
      for (const id of newIds) {
        const p = positions.get(id);
        if (p) newMinX = Math.min(newMinX, p.x);
      }
      if (newMinX < existingMaxX + NEW_CHAIN_GAP) {
        const shiftX = existingMaxX + NEW_CHAIN_GAP - newMinX;
        for (const id of newIds) {
          const p = positions.get(id);
          if (p) positions.set(id, { x: p.x + shiftX, y: p.y });
        }
      }
    }
  }

  return positions;
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  projectPath?: string | null,
  existingPositions?: ExistingPositions,
  measuredSizesById?: MeasuredNodeSizesById
): Node[] {
  const entryId = '__arcforge_entry__';
  const positions = computeLayoutPositionsMap(nodes, edges, projectPath, existingPositions, measuredSizesById);
  const projectFolderName = typeof projectPath === 'string' && projectPath
    ? projectPath.replace(/^.*[/\\]/, '') || 'App'
    : 'App';
  const entryNode: Node = {
    id: entryId,
    type: 'entry',
    position: positions.get(entryId) ?? { x: 0, y: 0 },
    data: { label: projectFolderName, nodeType: 'entry' },
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
  };
  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
  }));
  return [entryNode, ...positionedNodes];
}

const ENTRY_ID = '__arcforge_entry__';

/**
 * Builds layouted nodes (entry + nodes with position) from a positions map.
 * Used when layout was computed in a Web Worker.
 */
export function buildLayoutedNodesFromPositions(
  nodes: Node[],
  positions: LayoutPositions,
  projectPath?: string | null
): Node[] {
  const projectFolderName = typeof projectPath === 'string' && projectPath
    ? projectPath.replace(/^.*[/\\]/, '') || 'App'
    : 'App';
  const entryNode: Node = {
    id: ENTRY_ID,
    type: 'entry',
    position: positions[ENTRY_ID] ?? { x: 0, y: 0 },
    data: { label: projectFolderName, nodeType: 'entry' },
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
  };
  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? { x: 0, y: 0 },
    sourcePosition: 'right' as const,
    targetPosition: 'left' as const,
  }));
  return [entryNode, ...positionedNodes];
}
