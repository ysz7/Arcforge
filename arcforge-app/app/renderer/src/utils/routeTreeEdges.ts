/**
 * Build synthetic edges from route path hierarchy so the graph branches left-to-right.
 * E.g. "/" -> "/products" -> "/products/{slug}", "/" -> "/cart", etc.
 */

import type { ArcforgeGraph } from '../global';

/** Extract path from route label: "GET /products" -> "/products", "POST /cart/add" -> "/cart/add" */
function pathFromRouteLabel(label: string): string | null {
  const trimmed = label.trim();
  const match = trimmed.match(/^(?:GET|POST|PUT|PATCH|DELETE|MIDDLEWARE)\s+(\S+)/i);
  return match ? match[1] : null;
}

/** Parent path: "/products/slug" -> "/products", "/products" -> "/", "/" -> null */
function parentPath(path: string): string | null {
  if (!path || path === '/') return null;
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return path.slice(0, lastSlash);
}

/**
 * Add synthetic edges between route nodes so path hierarchy becomes a tree (left to right).
 * Modifies edges array in place.
 */
export function addRouteTreeEdges(graph: ArcforgeGraph): ArcforgeGraph {
  const routeNodes = graph.nodes.filter((n) => n.type === 'route');
  if (routeNodes.length === 0) return graph;

  const pathToNodeIds = new Map<string, string[]>();
  for (const n of routeNodes) {
    const path = pathFromRouteLabel(n.label);
    if (path == null) continue;
    const list = pathToNodeIds.get(path) ?? [];
    list.push(n.id);
    pathToNodeIds.set(path, list);
  }

  const edges = [...graph.edges];
  const existingPairs = new Set(edges.map((e) => `${e.from}\t${e.to}`));

  for (const [path, ids] of pathToNodeIds) {
    const parent = parentPath(path);
    if (parent == null) continue;
    const parentIds = pathToNodeIds.get(parent);
    if (!parentIds?.length) continue;
    const parentId = parentIds[0];
    for (const childId of ids) {
      if (parentId === childId) continue;
      const key = `${parentId}\t${childId}`;
      if (existingPairs.has(key)) continue;
      existingPairs.add(key);
      edges.push({
        id: `route-tree:${parentId}:${childId}`,
        from: parentId,
        to: childId,
        type: 'route_tree',
      });
    }
  }

  return { ...graph, edges };
}
