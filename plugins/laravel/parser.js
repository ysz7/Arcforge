// @ts-check
/// <reference path="./arcforge.d.ts" />

const {
  node, edge, readFile, walkDir, exists,
  basename, extname, dirname, joinPath,
} = require('./arcforge-sdk');

// ── helpers ───────────────────────────────────────────────────────────────────

/** Extract PHP class name from file content (class Foo / abstract class Foo). */
function getClassName(content) {
  const m = content.match(/(?:abstract\s+|final\s+)?class\s+(\w+)/);
  return m ? m[1] : null;
}

// ── parse ─────────────────────────────────────────────────────────────────────

exports.parse = async function parse(input) {
  const nodes = [];
  const edges = [];
  const root = input.path;

  // Maps: className / viewName → node (for edge linking)
  /** @type {Map<string, object>} */
  const modelMap = new Map();
  /** @type {Map<string, object>} */
  const controllerMap = new Map();
  // ── Models ─────────────────────────────────────────────────────────────────
  const modelsDir = joinPath(root, 'app', 'Models');
  if (exists(modelsDir)) {
    for (const fp of walkDir(modelsDir, { extensions: ['.php'], maxDepth: 3 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      const n = node('laravel_model', name, { filePath: fp });
      nodes.push(n);
      modelMap.set(name, n);
    }
  } else {
    // Laravel 7 and below: models live directly in app/
    const appDir = joinPath(root, 'app');
    if (exists(appDir)) {
      for (const fp of walkDir(appDir, { extensions: ['.php'], maxDepth: 1 })) {
        const content = readFile(fp) || '';
        if (!/extends\s+Model/.test(content)) continue;
        const name = getClassName(content) || basename(fp, '.php');
        const n = node('laravel_model', name, { filePath: fp });
        nodes.push(n);
        modelMap.set(name, n);
      }
    }
  }

  // ── Model relationships ────────────────────────────────────────────────────
  // Only "parent" relations (hasMany, hasOne, hasManyThrough) to avoid
  // duplicate bidirectional edges (belongsTo is the reverse of hasMany).
  const edgePairs = new Set();
  for (const [, modelNode] of modelMap) {
    const content = readFile(/** @type {any} */(modelNode).filePath) || '';
    const relRegex = /->(hasMany|hasOne|hasManyThrough|morphMany|morphOne)\s*\(\s*\\?(\w+)::class/g;
    let m;
    while ((m = relRegex.exec(content)) !== null) {
      const relType = m[1];
      const targetName = m[2];
      const targetNode = modelMap.get(targetName);
      if (!targetNode || targetNode === modelNode) continue;
      // Deduplicate: skip if same pair already added in either direction
      const pairKey = [/** @type {any} */(modelNode).id, /** @type {any} */(targetNode).id].sort().join('|');
      if (edgePairs.has(pairKey)) continue;
      edgePairs.add(pairKey);
      edges.push(edge(relType, /** @type {any} */(modelNode).id, /** @type {any} */(targetNode).id));
    }
  }

  // ── Controllers ────────────────────────────────────────────────────────────
  const controllersDir = joinPath(root, 'app', 'Http', 'Controllers');
  /** @type {Array<{fp: string, name: string, n: object, content: string}>} */
  const controllerData = [];
  if (exists(controllersDir)) {
    for (const fp of walkDir(controllersDir, { extensions: ['.php'], maxDepth: 5 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      const n = node('laravel_controller', name, { filePath: fp });
      nodes.push(n);
      controllerMap.set(name, n);
      controllerData.push({ fp, name, n, content });
    }
  }

  // Controller → Model edges (via `use App\Models\X`)
  for (const { n, content } of controllerData) {
    const useRe = /use\s+App\\(?:Models\\)?(\w+)/g;
    let m;
    while ((m = useRe.exec(content)) !== null) {
      const modelName = m[1];
      if (modelMap.has(modelName)) {
        edges.push(edge('uses', /** @type {any} */(n).id, /** @type {any} */(modelMap.get(modelName)).id));
      }
    }
  }

  // ── Middleware ─────────────────────────────────────────────────────────────
  const middlewareDir = joinPath(root, 'app', 'Http', 'Middleware');
  if (exists(middlewareDir)) {
    for (const fp of walkDir(middlewareDir, { extensions: ['.php'], maxDepth: 2 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      nodes.push(node('laravel_middleware', name, { filePath: fp }));
    }
  }

  // ── Routes ────────────────────────────────────────────────────────────────
  // Routes are collapsed into group nodes (one per file + prefix).
  // Individual route nodes are NOT created — group → controller edges only.
  // Each group node stores a route list in its description for the export.
  const routesDir = joinPath(root, 'routes');
  if (exists(routesDir)) {
    for (const fp of walkDir(routesDir, { extensions: ['.php'], maxDepth: 1 })) {
      const content = readFile(fp) || '';
      const fileName = basename(fp, '.php'); // "web" | "api" | "console" | ...

      // ── parse lines tracking current prefix ────────────────────────────────
      /** @type {Array<{method: string, uri: string, prefix: string, ctrl: string|null}>} */
      const collected = [];
      /** @type {string[]} */
      const prefixStack = [];

      for (const line of content.split('\n')) {
        const prefixMatch = line.match(/Route::prefix\s*\(\s*['"]([^'"]+)['"]/);
        if (prefixMatch) prefixStack.push('/' + prefixMatch[1].replace(/^\//, ''));
        if (/^\s*\}\s*\)\s*;?\s*$/.test(line) && prefixStack.length) prefixStack.pop();

        const rm = line.match(
          /Route::(get|post|put|patch|delete|any|options|resource|apiResource)\s*\(\s*['"]([^'"]+)['"]/i
        );
        if (!rm) continue;

        const method = rm[1].toUpperCase();
        const rawUri = rm[2];
        const prefix = prefixStack[prefixStack.length - 1] ?? '';
        const uri = prefix ? `${prefix}/${rawUri.replace(/^\//, '')}` : rawUri;

        // Group key: active prefix OR first URI segment (for middleware-only groups)
        const firstSegment = uri.split('/').filter(Boolean)[0] ?? '';
        const groupKey = prefix || (firstSegment ? '/' + firstSegment : '/');

        const cm = line.match(/\[(\w+)::class/) || line.match(/['"]([A-Za-z]+Controller)@/);
        collected.push({ method, uri, groupKey, ctrl: cm ? cm[1] : null });
      }

      if (collected.length === 0) continue;

      // ── collect routes per prefix ─────────────────────────────────────────
      /** @type {Map<string, {ctrlsSeen: Set<string>, routes: string[], ctrls: string[]}>} */
      const prefixData = new Map();

      for (const { method, uri, groupKey, ctrl } of collected) {
        if (!prefixData.has(groupKey)) {
          prefixData.set(groupKey, { ctrlsSeen: new Set(), routes: [], ctrls: [] });
        }
        const g = prefixData.get(groupKey);
        g.routes.push(`${method} ${uri}`);
        if (ctrl && !g.ctrlsSeen.has(ctrl)) {
          g.ctrlsSeen.add(ctrl);
          g.ctrls.push(ctrl);
        }
      }

      // ── build one group node per unique group key (with description) ────────
      for (const [groupKey, g] of prefixData) {
        const label = groupKey && groupKey !== '/' ? `${fileName} ${groupKey}` : fileName;
        const description = g.routes.join('\n');
        const gn = node('laravel_route_group', label, { filePath: fp, description });
        nodes.push(gn);

        // group → controller edges
        for (const ctrl of g.ctrls) {
          if (controllerMap.has(ctrl)) {
            edges.push(edge('dispatches', /** @type {any} */(gn).id, /** @type {any} */(controllerMap.get(ctrl)).id));
          }
        }
      }
    }
  }

  // ── Migrations ────────────────────────────────────────────────────────────
  const migrationsDir = joinPath(root, 'database', 'migrations');
  if (exists(migrationsDir)) {
    for (const fp of walkDir(migrationsDir, { extensions: ['.php'], maxDepth: 1 })) {
      const content = readFile(fp) || '';
      // Extract table name from Schema::create('table', ...) or Schema::table('table', ...)
      const tableMatch = content.match(/Schema::(create|table)\s*\(\s*['"]([^'"]+)['"]/);
      const label = tableMatch
        ? tableMatch[2]
        : basename(fp, '.php').replace(/^\d{4}_\d{2}_\d{2}_\d{6}_/, '');
      nodes.push(node('laravel_migration', label, { filePath: fp }));
    }
  }

  // ── Services ──────────────────────────────────────────────────────────────
  const servicesDir = joinPath(root, 'app', 'Services');
  if (exists(servicesDir)) {
    for (const fp of walkDir(servicesDir, { extensions: ['.php'], maxDepth: 3 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      nodes.push(node('laravel_service', name, { filePath: fp }));
    }
  }

  // ── Providers ─────────────────────────────────────────────────────────────
  const providersDir = joinPath(root, 'app', 'Providers');
  if (exists(providersDir)) {
    for (const fp of walkDir(providersDir, { extensions: ['.php'], maxDepth: 2 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      nodes.push(node('laravel_provider', name, { filePath: fp }));
    }
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobsDir = joinPath(root, 'app', 'Jobs');
  if (exists(jobsDir)) {
    for (const fp of walkDir(jobsDir, { extensions: ['.php'], maxDepth: 3 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      nodes.push(node('laravel_job', name, { filePath: fp }));
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────
  const eventsDir = joinPath(root, 'app', 'Events');
  if (exists(eventsDir)) {
    for (const fp of walkDir(eventsDir, { extensions: ['.php'], maxDepth: 3 })) {
      const content = readFile(fp) || '';
      const name = getClassName(content) || basename(fp, '.php');
      nodes.push(node('laravel_event', name, { filePath: fp }));
    }
  }

  return { nodes, edges };
};

// ── reload ────────────────────────────────────────────────────────────────────
exports.reload = async function reload(input) {
  return exports.parse(input);
};

// ── onNodeClick ───────────────────────────────────────────────────────────────
exports.onNodeClick = async function onNodeClick(clickedNode) {
  if (!clickedNode.filePath) return null;
  const ext = extname(clickedNode.filePath);
  const language = ext === '.php' ? 'php' : 'plaintext';
  return { filePath: clickedNode.filePath, language };
};

// ── onExport ──────────────────────────────────────────────────────────────────
exports.onExport = async function onExport(graph) {
  const byType = {};
  for (const n of graph.nodes) {
    if (!byType[n.type]) byType[n.type] = [];
    byType[n.type].push(n.label);
  }

  const typeLabels = {
    laravel_model:        'Models',
    laravel_controller:   'Controllers',
    laravel_route_group:  'Route Groups',
    laravel_migration:  'Migrations',
    laravel_middleware: 'Middleware',
    laravel_service:    'Services',
    laravel_provider:   'Providers',
    laravel_job:        'Jobs',
    laravel_event:      'Events',
  };

  const lines = ['# Laravel Project — Architecture\n'];
  for (const [type, label] of Object.entries(typeLabels)) {
    if (!byType[type] || byType[type].length === 0) continue;
    lines.push(`## ${label}`);
    for (const name of byType[type]) lines.push(`- ${name}`);
    lines.push('');
  }

  lines.push('## Relationships');
  for (const e of graph.edges) {
    const src = graph.nodes.find(n => n.id === e.source);
    const tgt = graph.nodes.find(n => n.id === e.target);
    if (src && tgt) lines.push(`- ${src.label} --[${e.type}]--> ${tgt.label}`);
  }

  return lines.join('\n');
};
