## Arcforge desktop – Changelog

## 1.3.0 - Plugins & Redesign

### Plugin System

- **Plugin SDK** — Introduced an open plugin system. Any language or framework can be supported by writing a plugin with three files: `manifest.json`, `nodes.js`, and `parser.js`.
- **Laravel plugin** — Official plugin for visualizing Laravel projects: Models, Controllers, Routes, Views, Migrations and more.
- **Plugin marketplace** — Plugin directory added to the repository. Community plugins can be shared and installed.
- **Security** — Arcforge shows a security warning when loading any third-party plugin. Only install plugins from sources you trust.

### Design update

- **Application redesign** — Updated visual design of the desktop application.
- **New landing page** — Fully redesigned website with updated layout, navigation, and plugin documentation.

---

## 1.2.0 - ArcSpec

- **ArcSpec adapter** — Added a new architecture-first adapter for describing backend architecture as connected nodes (domains, use cases, repositories, modules, microservices, etc.).
- **Architecture blueprints** — Introduced ready-made blueprints for MVC, Clean Architecture, Modular Monolith flows. Blueprints are grouped, searchable, and configurable via the Forge modal.

### Node management (ArcSpec)

- **Entry nodes** - Support for multiple Entry nodes that can be created on the canvas; the primary `arch:entry` remains protected from deletion.
- **Context menus** — Unified right-click menus for ArcSpec nodes and edges, including bulk delete for multiple selected nodes and safer deletion flows.
- **Rename nodes** — Nodes in ArcSpec graphs can be renamed via a dedicated prompt, with changes persisted back into the `.json` architecture specification.


### 1.1.1 - OpenAPI JSON viewer

- **OpenAPI JSON viewer** to inspect and explore OpenAPI specifications directly inside Arcforge.
- View and scroll through OpenAPI (Swagger) JSON definitions without leaving the app.

### 1.0.1 - Redesign & performance

- **Redesign** of the application.
- **Fewer displayed connections** — the number of edges shown on the graph is reduced; the logic chain and behavior remain the same.
- **Application and connection optimization** — the app and graph rendering are optimized so that **large projects handle graph load better**.

### 1.0.0 – Initial public manifest

- First public version of the Arcforge update manifest.
- Landing page and GitHub Pages configuration documentation.
- JSON schema defined for desktop client integration.

