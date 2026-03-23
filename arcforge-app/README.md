# Arcforge — Source Code

This is the source code for [Arcforge](https://github.com/ysz7/Arcforge) — a graph-based IDE and architecture explorer for backend projects.

Built with **Electron**, **React 18**, **TypeScript**, and **Vite**.

## Requirements

- Node.js 18+
- Windows x64 (other platforms not tested)

## Getting started

```bash
git clone https://github.com/ysz7/Arcforge.git
cd Arcforge/arcforge-app
npm install
npm run dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Build and launch in watch mode (hot-reload) |
| `npm run build` | Production build |
| `npm start` | Build and run once |
| `npm run dist:win` | Package as Windows installer + portable `.exe` |
| `npm run lint` | Run ESLint |

## Tech stack

| Layer | Technology |
|---|---|
| Shell | Electron 35 |
| UI | React 18, TypeScript |
| Bundler | Vite 7 |
| Graph | React Flow, Dagre |
| Editor | Monaco Editor |
| UI components | Radix UI |
| State | Zustand |
| File watching | Chokidar |

## Project structure

```
arcforge-app/
├── app/
│   ├── electron/       # Main process (window, IPC, file system)
│   └── renderer/       # React app (graph view, editor, sidebar)
├── scripts/            # Build helpers
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Plugin system

Arcforge loads plugins at runtime — they are not bundled into the app source. See the [Plugin SDK](https://github.com/ysz7/Arcforge/tree/main/SDK) for how to build your own.

## License

MIT — see [LICENSE](https://github.com/ysz7/Arcforge/blob/main/LICENSE).
