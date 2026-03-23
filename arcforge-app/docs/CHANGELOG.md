# Changelog

All notable changes to Arcforge are documented in this file.

---

## [1.2.0] — 2026-02-27

### New

- **ArcSpec adapter** — Added a new architecture-first adapter for describing backend architecture as connected nodes (domains, use cases, repositories, modules, microservices, etc.).
- **Architecture blueprints** — Introduced ready-made blueprints for MVC, Clean Architecture, Modular Monolith flows. Blueprints are grouped, searchable, and configurable via the Forge modal.

### Node management (ArcSpec)

- **Entry nodes** — Support for multiple Entry nodes that can be created on the canvas; the primary `arch:entry` remains protected from deletion.
- **Context menus** — Unified right-click menus for ArcSpec nodes and edges, including bulk delete for multiple selected nodes and safer deletion flows.
- **Rename nodes** — Nodes in ArcSpec graphs can be renamed via a dedicated prompt, with changes persisted back into the `.json` architecture specification.

---

## [1.1.1] — 2025-02-27


### Fixed three generation on the graph

### Fixes and improvements

- **Unified tree layout** — Laravel now uses the same layered tree layout as OpenAPI/JSON (depth + parent-order sorting).
- **Layout spacing** — Increased X_GAP (320), Y_GAP (150), and GROUP_GAP (24) for clearer spacing and less overlapping edges.
- **View menu** — Removed "Editor in tabs" and "Editor split with graph" options.
- **OpenAPI graph** — Components → schema edges only for root-referenced schemas; reduces visual clutter.
- **Welcome screen** — OpenAPI logo added next to Laravel.
- **App redesign** — Updated welcome screen styling (supported technologies row), refined icon typography, and small UI polish across the app.

---

## [1.1.0] — 2025-02-27

### Redesign

- **Visual cleanup** - Per-method connection dots hidden; all connection lines use solid strokes. Reduced edge count makes the graph easier to read and cheaper to render.

### New features

- **Open API JSON viewer** — Open OpenAPI/Swagger JSON files via File → Open JSON. The graph visualizes:
  - Info (title, version, description, terms of service, contact, license)
  - Paths and operations (GET, POST, etc.)
  - Parameters (path-level + operation-level merged)
  - Request body with schema reference
  - Responses with status codes and examples
  - Components: schemas with `$ref` edges (e.g. Pet → NewPet)
  - Servers
- **Single-file mode** — When opening a single JSON file, the explorer shows only that file and uses its name (uppercase, no extension) as the title.
- **Rebuild layout config** — File menu option to reset the graph layout to default and save to `.arcforge`. Confirmation modal before rebuild.
- **Editor scroll position** — Scroll position is preserved when switching between tabs. Positions are stored in memory for all open file tabs.

### Performance

- **Multi-core layout** — Graph layout (Dagre + CLI block positioning) now runs in a **Web Worker** on a separate thread. The main thread stays responsive while layout computes in the background. Large graphs no longer freeze the app during re-layout.
- **Worker-based layout pipeline** — Layout requests are deduplicated by ID; only the latest layout is applied. Scrolling, panning, and other interactions stay smooth during updates.

### Connection optimization

- **Route clusters** — Multiple routes per controller are grouped into a single **route cluster** node. One cluster → controller edge replaces many route → controller edges.
- **One edge per node pair for method bindings** — All method bindings between the same two nodes are collapsed into a **single edge** with an "N methods" label when applicable. Right-click → Delete still removes all underlying connections.
- **Fewer edges touching hidden nodes** — Edges to/from hidden node types (database, CLI, migrations) are no longer built or drawn.

---

*Result: redesigned UI, OpenAPI support, better use of multiple cores, fewer edges and DOM nodes, and a more responsive graph view.*
