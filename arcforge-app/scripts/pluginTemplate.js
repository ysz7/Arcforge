/**
 * Plugin template generator.
 * Called from the main process IPC handler plugins:create.
 *
 * Generates a complete starter plugin folder with:
 *   manifest.json, parser.js, nodes.js, arcforge.d.ts, README.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @param {string} destDir  - absolute path to the new plugin folder
 * @param {{ id: string, name: string, author: string, accepts: 'directory' | 'file' }} opts
 */
function generatePluginTemplate(destDir, opts) {
  const { id, name, author, accepts } = opts;

  fs.mkdirSync(destDir, { recursive: true });

  // --- manifest.json ---
  const manifest = {
    id,
    name,
    version: '1.0.0',
    author: author || '',
    description: `${name} plugin for Arcforge`,
    icon: '◻',
    parser: 'parser.js',
    nodes: 'nodes.js',
    accepts,
    fileTypes: accepts === 'file' ? ['.json'] : [],
    canCreateNew: false,
    detectBy: [],
    capabilities: {
      openFileOnNodeClick: true,
      editNodes: false,
      addNodes: false,
      deleteNodes: false,
      addEdges: false,
      deleteEdges: false,
      saveGraph: false,
      exportPrompt: true,
    },
  };
  fs.writeFileSync(
    path.join(destDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  // --- nodes.js ---
  const nodesContent = `// nodes.js — define custom node types for your plugin
// Each type appears as a card in the graph canvas.
// 'id' must match the 'type' field in nodes returned from parse().

module.exports = [
  {
    id: '${id}_item',
    label: 'Item',
    description: 'A generic item node.',
    color: '#4a9eff',
    icon: '◻',
    deletable: true,
    renameable: true,
    openable: true,   // true = clicking node opens filePath in code tab
  },
];
`;
  fs.writeFileSync(path.join(destDir, 'nodes.js'), nodesContent, 'utf-8');

  // --- parser.js ---
  const acceptsComment = accepts === 'directory'
    ? '// input.path — absolute path to the folder the user selected'
    : '// input.path — absolute path to the file the user selected';

  const parserContent = `// @ts-check
/// <reference path="./arcforge.d.ts" />

// Arcforge SDK — helpers for creating nodes, edges, reading files.
// Available: uid, node, edge, readFile, readDir, walkDir, exists, basename, extname, dirname, joinPath
const { node, edge, uid, readFile, walkDir, exists, basename } = require('./arcforge-sdk');

${acceptsComment}
exports.parse = async function parse(input) {
  const nodes = [];
  const edges = [];

  // ── Example: create a root node ──────────────────────────────────────────
  const root = node('${id}_item', '${name}', { filePath: input.path });
  nodes.push(root);

  // ── Example: walk files in the directory ─────────────────────────────────
  ${accepts === 'directory' ? `const files = walkDir(input.path, { extensions: ['.js', '.ts'], maxDepth: 3 });

  for (const filePath of files) {
    const fileName = basename(filePath);
    const item = node('${id}_item', fileName, { filePath });
    nodes.push(item);
    edges.push(edge('calls', root.id, item.id));
  }` : `// Read file content
  const content = readFile(input.path);
  if (content) {
    // Parse content and create nodes/edges
    // const item = node('${id}_item', 'Parsed Item', { filePath: input.path });
    // nodes.push(item);
    // edges.push(edge('calls', root.id, item.id));
  }`}

  return { nodes, edges };
};

// ── reload — called when a file in the project changes ───────────────────────
// Optional. If not exported, Arcforge calls parse() again on file change.
exports.reload = async function reload(input) {
  return exports.parse(input);
};

// ── onNodeClick — called when user clicks a node ─────────────────────────────
// Optional. Return { filePath, language, scrollTo } to open file in code tab.
// Only called if capabilities.openFileOnNodeClick is true.
exports.onNodeClick = async function onNodeClick(clickedNode) {
  if (!clickedNode.filePath) return null;
  return {
    filePath: clickedNode.filePath,
    language: 'javascript',  // syntax highlight hint
    scrollTo: undefined,      // optional line number
  };
};

// ── onExport — called when user clicks Export Prompt ─────────────────────────
// Optional. Return an AI-ready string describing the graph.
exports.onExport = async function onExport(graph) {
  const lines = ['# ${name} — Architecture\\n'];
  for (const n of graph.nodes) {
    lines.push(\`- [\${n.type}] \${n.label}\`);
  }
  return lines.join('\\n');
};
`;
  fs.writeFileSync(path.join(destDir, 'parser.js'), parserContent, 'utf-8');

  // --- README.md ---
  const readmeContent = `# ${name} — Arcforge Plugin

> Plugin ID: \`${id}\` | Accepts: **${accepts}**

## Overview

This is an **Arcforge plugin**. It tells Arcforge how to parse a ${accepts === 'directory' ? 'folder' : 'file'} and turn it into an interactive graph of nodes and edges.

---

## Folder structure

\`\`\`
${id}/
├── manifest.json     # Plugin metadata and capabilities declaration
├── nodes.js          # Node type definitions (shape, color, label)
├── parser.js         # Core logic: parse → nodes/edges, click handlers, export
├── arcforge-sdk.js   # Arcforge helper library (bundled, do not edit)
├── arcforge.d.ts     # TypeScript type definitions for IDE autocomplete
└── README.md         # This file
\`\`\`

---

## manifest.json — field reference

| Field | Type | Description |
|---|---|---|
| \`id\` | string | Unique plugin identifier (kebab-case) |
| \`name\` | string | Human-readable display name |
| \`version\` | string | Semver version of the plugin |
| \`author\` | string | Plugin author name |
| \`description\` | string | Short description shown in the plugin picker |
| \`icon\` | string | Single character / emoji shown as the plugin icon |
| \`parser\` | string | Relative path to the parser file (default: \`"parser.js"\`) |
| \`nodes\` | string | Relative path to the nodes definition file (default: \`"nodes.js"\`) |
| \`accepts\` | \`"directory"\` \\| \`"file"\` | Whether the user picks a folder or a single file |
| \`fileTypes\` | string[] | Allowed file extensions when \`accepts\` is \`"file"\` (e.g. \`[".json"]\`) |
| \`canCreateNew\` | boolean | If \`true\`, a "Create new" button appears in addition to "Open existing" |
| \`detectBy\` | string[] | File/folder patterns that auto-detect this plugin (future feature) |
| \`capabilities\` | object | Feature flags — controls which actions are enabled in the UI |

### capabilities flags

\`\`\`json
{
  "openFileOnNodeClick": true,   // clicking a node opens its file in the code tab
  "editNodes":          false,   // allow inline node label editing
  "addNodes":           false,   // allow adding new nodes via right-click menu
  "deleteNodes":        false,   // allow deleting nodes
  "addEdges":           false,   // allow drawing new edges between nodes
  "deleteEdges":        false,   // allow deleting edges
  "saveGraph":          false,   // enable Save (persists graph back to source files)
  "exportPrompt":       true     // enable "Export Prompt" button (AI-ready text export)
}
\`\`\`

---

## nodes.js — node type definitions

Each entry describes one visual card type on the graph canvas.

\`\`\`js
module.exports = [
  {
    id: 'my_node',          // must match 'type' field returned from parse()
    label: 'My Node',       // default display label
    description: '...',     // tooltip text
    color: '#4a9eff',       // hex card accent color
    icon: '◻',              // single character / emoji
    deletable: true,        // can user delete this node type?
    renameable: true,       // can user rename this node?
    openable: true,         // clicking opens filePath in the code tab
  },
];
\`\`\`

---

## parser.js — exported functions

### Required

#### \`exports.parse(input) → Promise<{ nodes, edges }>\`

Called when the user opens a project. Must return the full graph.

\`\`\`js
exports.parse = async function parse(input) {
  // input.path  — absolute path to the folder or file the user selected
  const nodes = [];
  const edges = [];
  // ... build nodes and edges ...
  return { nodes, edges };
};
\`\`\`

**Node object** (use \`node()\` SDK helper):
\`\`\`js
{
  id: 'unique-string',   // auto-generated by node() helper
  type: 'my_node',       // must match an id in nodes.js
  label: 'Display Name',
  filePath: '/abs/path', // optional — file to open on click
  // ... any extra data fields you need
}
\`\`\`

**Edge object** (use \`edge()\` SDK helper):
\`\`\`js
{
  id: 'unique-string',
  type: 'calls',         // edge label/type
  source: 'node-id-a',
  target: 'node-id-b',
}
\`\`\`

---

### Optional

#### \`exports.reload(input) → Promise<{ nodes, edges }>\`

Called when a watched file changes. If not exported, Arcforge calls \`parse()\` again.

---

#### \`exports.onNodeClick(node) → Promise<{ filePath, language, scrollTo } | null>\`

Called when a node is clicked (only if \`capabilities.openFileOnNodeClick\` is true).
Return an object to open a file in the code tab, or \`null\` to do nothing.

\`\`\`js
exports.onNodeClick = async function onNodeClick(node) {
  if (!node.filePath) return null;
  return {
    filePath: node.filePath,
    language: 'javascript', // syntax highlight language hint
    scrollTo: 42,           // optional line number to scroll to
  };
};
\`\`\`

---

#### \`exports.onExport(graph) → Promise<string>\`

Called when the user clicks **Export Prompt**. Return an AI-ready string.

\`\`\`js
exports.onExport = async function onExport(graph) {
  // graph.nodes — array of all nodes
  // graph.edges — array of all edges
  const lines = ['# ${name} — Architecture'];
  for (const n of graph.nodes) {
    lines.push(\`- [\${n.type}] \${n.label}\`);
  }
  return lines.join('\\n');
};
\`\`\`

---

#### \`exports.onSave(graph, context) → Promise<void>\`

Called when the user saves the graph (only if \`capabilities.saveGraph\` is true).
Use this to persist the graph back to your source files.

\`\`\`js
exports.onSave = async function onSave(graph, context) {
  // context.entryPath — the original folder/file path
  // graph.nodes, graph.edges — current graph state
};
\`\`\`

---

#### \`exports.onNodeEdit(node) → Promise<void>\`
#### \`exports.onNodeCreate(node, context) → Promise<void>\`
#### \`exports.onNodeDelete(node, context) → Promise<void>\`
#### \`exports.onEdgeCreate(edge, context) → Promise<void>\`

Mutation hooks called when nodes/edges are added, edited, or removed. Only triggered when the matching capability flag is \`true\`.

---

## arcforge-sdk.js — helper reference

Import what you need at the top of \`parser.js\`:

\`\`\`js
const { node, edge, uid, readFile, readDir, walkDir, exists,
        basename, extname, dirname, joinPath } = require('./arcforge-sdk');
\`\`\`

| Helper | Signature | Description |
|---|---|---|
| \`node\` | \`(type, label, data?) → SdkNode\` | Create a node object |
| \`edge\` | \`(type, source, target, data?) → SdkEdge\` | Create an edge object |
| \`uid\` | \`() → string\` | Generate a unique ID |
| \`readFile\` | \`(filePath) → string \\| null\` | Read file as UTF-8 string |
| \`readDir\` | \`(dirPath) → string[]\` | List immediate children (full paths) |
| \`walkDir\` | \`(dirPath, opts?) → string[]\` | Recursively list files. opts: \`{ extensions, maxDepth }\` |
| \`exists\` | \`(p) → boolean\` | Check if path exists |
| \`basename\` | \`(p, ext?) → string\` | File name from path |
| \`extname\` | \`(p) → string\` | File extension (e.g. \`".ts"\`) |
| \`dirname\` | \`(p) → string\` | Directory portion of path |
| \`joinPath\` | \`(...parts) → string\` | Join path segments |

---

## Development workflow

1. Edit \`nodes.js\` to define your node types.
2. Edit \`parser.js\` — implement \`parse()\` to read your files and return nodes + edges.
3. In Arcforge: **File → Open Project** → pick this plugin → **Open existing** → select your project.
4. The graph will render. Click nodes to open files. Right-click for context menu.
5. Edit \`parser.js\` or \`nodes.js\` — Arcforge automatically detects the change and re-parses the graph (hot-reload).

---

---

## AI Prompt — let Claude or ChatGPT write your plugin

Copy the block below and paste it into Claude, ChatGPT, or any AI assistant.
Fill in the **[BRACKETS]** and the AI will generate a complete, working plugin.

\`\`\`
You are an expert Arcforge plugin developer.
Arcforge is an Electron desktop app that visualizes codebases as interactive node-edge graphs.

I need a plugin that parses [DESCRIBE YOUR PROJECT TYPE — e.g. "a Python Django project folder"]
and shows it as a graph where [DESCRIBE WHAT NODES REPRESENT — e.g. "models, views, and URL routes are nodes"].

== PLUGIN CONTRACT ==

A plugin is a folder containing exactly these files:
  manifest.json  — metadata and capability flags
  nodes.js       — array of node type definitions
  parser.js      — async parse(), optional reload(), onNodeClick(), onExport(), onSave()
  arcforge-sdk.js — provided, do not generate, just require() it

== manifest.json schema ==
{
  "id": "kebab-case-unique-id",
  "name": "Human Name",
  "version": "1.0.0",
  "author": "...",
  "description": "...",
  "icon": "single char or emoji",
  "parser": "parser.js",
  "nodes": "nodes.js",
  "accepts": "directory" | "file",
  "fileTypes": ["ext"] // only when accepts=file
  "canCreateNew": false,
  "detectBy": [],
  "capabilities": {
    "openFileOnNodeClick": true/false,
    "editNodes": true/false,
    "addNodes": true/false,
    "deleteNodes": true/false,
    "addEdges": true/false,
    "deleteEdges": true/false,
    "saveGraph": true/false,
    "exportPrompt": true/false
  }
}

== nodes.js schema ==
module.exports = [
  {
    id: 'type_id',       // matched by node type field
    label: 'Label',
    description: '...',
    color: '#hex',
    icon: '◻',
    deletable: true,
    renameable: true,
    openable: true
  }
];

== parser.js contract ==
const { node, edge, uid, readFile, readDir, walkDir, exists,
        basename, extname, dirname, joinPath } = require('./arcforge-sdk');

// REQUIRED
exports.parse = async function parse(input) {
  // input.path = absolute path chosen by user
  // return { nodes: SdkNode[], edges: SdkEdge[] }
};

// OPTIONAL
exports.reload = async function reload(input) { ... };
exports.onNodeClick = async function onNodeClick(clickedNode) {
  // return { filePath, language, scrollTo } or null
};
exports.onExport = async function onExport(graph) {
  // return string (AI-ready architecture description)
};
exports.onSave = async function onSave(graph, context) {
  // context.entryPath = original path
};

== SDK helpers ==
node(type, label, data?)  → { id, type, label, ...data }
edge(type, source, target, data?) → { id, type, source, target, ...data }
uid() → unique string
readFile(path) → string | null
walkDir(path, { extensions: ['.ts'], maxDepth: 3 }) → string[]
readDir(path) → string[]
exists(path) → boolean
basename, extname, dirname, joinPath — same as Node.js path module

== MY PLUGIN REQUIREMENTS ==
- Plugin ID: [your-plugin-id]
- Plugin name: [Your Plugin Name]
- Accepts: [directory or file]
- What to parse: [describe the folder/file structure]
- Node types needed: [list each type with color and icon suggestions]
- Edge types needed: [list relationships between nodes]
- Should clicking a node open a file? [yes/no — which file?]
- Export prompt format: [describe what the AI export text should look like]

Generate all three files: manifest.json, nodes.js, parser.js.
Use only Node.js built-ins and the arcforge-sdk. No npm packages.
\`\`\`
`;
  fs.writeFileSync(path.join(destDir, 'README.md'), readmeContent, 'utf-8');

  return { ok: true, path: destDir };
}

module.exports = { generatePluginTemplate };
