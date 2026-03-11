"use strict";
/**
 * Arcforge Plugin SDK — helper utilities for plugin authors.
 *
 * Built-in usage:  const sdk = require('../arcforge-sdk')
 * User plugin:     const sdk = require('../arcforge-sdk')   // from ~/Documents/Arcforge/Plugins/my-plugin/
 *
 * The SDK is a standalone file — no Arcforge internals, only Node.js built-ins.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinPath = exports.dirname = exports.extname = exports.basename = void 0;
exports.uid = uid;
exports.node = node;
exports.edge = edge;
exports.readFile = readFile;
exports.readDir = readDir;
exports.walkDir = walkDir;
exports.exists = exists;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// ---------------------------------------------------------------------------
// uid — generate a short unique id
// ---------------------------------------------------------------------------
function uid(prefix) {
    const short = crypto.randomBytes(4).toString('hex');
    return prefix ? `${prefix}_${short}` : short;
}
// ---------------------------------------------------------------------------
// node — create a node object
// ---------------------------------------------------------------------------
function node(type, name, options) {
    const { filePath, position, description, ...rest } = options ?? {};
    return {
        id: uid(type.toLowerCase().replace(/\s+/g, '_')),
        type,
        ...(filePath ? { filePath } : {}),
        ...(position ? { position } : {}),
        data: {
            name,
            ...(description ? { description } : {}),
            ...rest,
        },
    };
}
// ---------------------------------------------------------------------------
// edge — create an edge object
// ---------------------------------------------------------------------------
function edge(type, sourceId, targetId) {
    return {
        id: uid('edge'),
        source: sourceId,
        target: targetId,
        type,
    };
}
// ---------------------------------------------------------------------------
// readFile — safely read a file as UTF-8 string
// ---------------------------------------------------------------------------
function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return null;
    }
}
function readDir(dirPath) {
    try {
        return fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({
            name: e.name,
            path: path.join(dirPath, e.name),
            isDirectory: e.isDirectory(),
        }));
    }
    catch {
        return [];
    }
}
// ---------------------------------------------------------------------------
// walkDir — recursively collect file paths
// ---------------------------------------------------------------------------
function walkDir(dirPath, options) {
    const ignore = new Set(options?.ignore ?? ['node_modules', 'vendor', '.git', '.arcforge']);
    const maxDepth = options?.maxDepth ?? Infinity;
    const extensions = options?.extensions ? new Set(options.extensions) : null;
    const results = [];
    function walk(dir, depth) {
        if (depth > maxDepth)
            return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (ignore.has(entry.name))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath, depth + 1);
            }
            else {
                if (extensions && !extensions.has(path.extname(entry.name)))
                    continue;
                results.push(fullPath);
            }
        }
    }
    walk(dirPath, 0);
    return results;
}
// ---------------------------------------------------------------------------
// exists — check if file/dir exists
// ---------------------------------------------------------------------------
function exists(filePath) {
    return fs.existsSync(filePath);
}
// ---------------------------------------------------------------------------
// basename / extname / dirname — re-exports for convenience
// ---------------------------------------------------------------------------
exports.basename = path.basename;
exports.extname = path.extname;
exports.dirname = path.dirname;
exports.joinPath = path.join;
module.exports = {
    uid,
    node,
    edge,
    readFile,
    readDir,
    walkDir,
    exists,
    basename: exports.basename,
    extname: exports.extname,
    dirname: exports.dirname,
    joinPath: exports.joinPath,
};
//# sourceMappingURL=arcforge-sdk.js.map