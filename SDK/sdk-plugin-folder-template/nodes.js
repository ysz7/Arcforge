// nodes.js — define custom node types for your plugin
// Each type appears as a card in the graph canvas.
// 'id' must match the 'type' field in nodes returned from parse().

module.exports = [
  {
    id: 'sdk-plugin-folder-template_item',
    label: 'Item',
    description: 'A generic item node.',
    color: '#4a9eff',
    icon: '◻',
    deletable: true,
    renameable: true,
    openable: true,   // true = clicking node opens filePath in code tab
  },
];
