/**
 * Copy non-TypeScript plugin assets to dist/plugins/ after tsc compilation.
 * - manifest.json for each plugin
 * - arcforge-sdk.js (compiled by tsc from arcforge-sdk.ts)
 * - arcforge.d.ts (type definitions for plugin authors)
 */

const fs = require('fs');
const path = require('path');

const srcPluginsDir = path.join(__dirname, '../app/plugins');
const dstPluginsDir = path.join(__dirname, '../dist/plugins');

if (!fs.existsSync(srcPluginsDir)) process.exit(0);

// Copy manifest.json for each plugin subfolder
const entries = fs.readdirSync(srcPluginsDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const manifestSrc = path.join(srcPluginsDir, entry.name, 'manifest.json');
  if (!fs.existsSync(manifestSrc)) continue;
  const dstDir = path.join(dstPluginsDir, entry.name);
  if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
  fs.copyFileSync(manifestSrc, path.join(dstDir, 'manifest.json'));
  console.log(`[copyManifests] ${entry.name}/manifest.json → dist/plugins/${entry.name}/manifest.json`);
}

// Copy arcforge.d.ts so it's available at dist/plugins/arcforge.d.ts
const dtsSrc = path.join(srcPluginsDir, 'arcforge.d.ts');
if (fs.existsSync(dtsSrc)) {
  if (!fs.existsSync(dstPluginsDir)) fs.mkdirSync(dstPluginsDir, { recursive: true });
  fs.copyFileSync(dtsSrc, path.join(dstPluginsDir, 'arcforge.d.ts'));
  console.log('[copyManifests] arcforge.d.ts → dist/plugins/arcforge.d.ts');
}
