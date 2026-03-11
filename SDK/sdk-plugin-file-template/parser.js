// @ts-check
/// <reference path="./arcforge.d.ts" />

// Arcforge SDK — helpers for creating nodes, edges, reading files.
// Available: uid, node, edge, readFile, readDir, walkDir, exists, basename, extname, dirname, joinPath
const { node, edge, uid, readFile, walkDir, exists, basename } = require('./arcforge-sdk');

// input.path — absolute path to the file the user selected
exports.parse = async function parse(input) {
  const nodes = [];
  const edges = [];

  // ── Example: create a root node ──────────────────────────────────────────
  const root = node('sdk-plugin-file-template_item', 'sdk-plugin-file-template', { filePath: input.path });
  nodes.push(root);

  // ── Example: walk files in the directory ─────────────────────────────────
  // Read file content
  const content = readFile(input.path);
  if (content) {
    // Parse content and create nodes/edges
    // const item = node('sdk-plugin-file-template_item', 'Parsed Item', { filePath: input.path });
    // nodes.push(item);
    // edges.push(edge('calls', root.id, item.id));
  }

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
  const lines = ['# sdk-plugin-file-template — Architecture\n'];
  for (const n of graph.nodes) {
    lines.push(`- [${n.type}] ${n.label}`);
  }
  return lines.join('\n');
};
