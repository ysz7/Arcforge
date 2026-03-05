## Arcforge <img src="docs/favicon.png" alt="Arcforge icon" width="32" align="right">

[![Platform: Windows x64](https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows&logoColor=white)](https://github.com/ysz7/Arcforge)
[![Backend: Laravel](https://img.shields.io/badge/backend-Laravel-FF2D20?logo=laravel&logoColor=white)](https://github.com/ysz7/Arcforge)
[![OpenAPI JSON viewer](https://img.shields.io/badge/OpenAPI-JSON%20viewer-6BA539?logo=openapiinitiative&logoColor=white)](https://github.com/ysz7/Arcforge)

**Graph-based IDE and architecture explorer for backend projects.**

Arcforge turns your backend into a navigable graph: controllers, services, models, and their dependencies become nodes and edges you can explore, understand, and refactor with more confidence.

- 🔍 **See your backend as a graph**, not as isolated files
- 🧭 **Trace request flows** across controllers, services, and data layers
- 📂 **Open any node to the real code** that powers it
- 🧱 **Design and evolve architectures** without losing track of how everything connects

> **Open Beta** · Windows desktop · **Planned next language:** Golang.

### Screenshots

<p align="center">
  <strong>Graph view</strong><br>
  <img src="docs/arcforge-gallery/arcforge-graph-1.png" alt="Graph view" width="720">
</p>

<p align="center">
  <strong>Add blueprint</strong><br>
  <img src="docs/arcforge-gallery/arcforge-modal-add-blueprint-2.png" alt="Add blueprint" width="720">
</p>

<p align="center">
  <strong>Add new logic</strong><br>
  <img src="docs/arcforge-gallery/arcforge-add-new-logic-3.png" alt="Add new logic" width="720">
</p>

---

### What Arcforge is good for

- **Architecture exploration** — understand unfamiliar Laravel projects faster with a visual map of your system.
- **Refactoring with context** — see what depends on what before you touch code and avoid hidden side effects.
- **API contract exploration** — view OpenAPI (Swagger) JSON specs directly inside the app, next to the backend graph.
- **Communication** — use the graph to explain backend flows to engineers, tech leads, and stakeholders.

> **Important**  
> The current Open Beta is best suited for **viewing and understanding projects**, especially small-to-medium codebases.  
> It is **not recommended** to rely on this version to edit or refactor **very large production projects** end-to-end.

Arcforge will **not modify your code automatically** during normal usage; it reads and indexes your project to build the graph.

---

### Status

> **Open Beta** · **Windows (x64)** · **Laravel backend** · **OpenAPI JSON viewer (beta)** · **Next:** Golang

Updates are distributed via:

- GitHub Releases, and
- a static `updates.json` manifest served from the Arcforge website.

The desktop app simply checks the manifest on startup to see whether a newer version is available.  
There are **no background services, telemetry, or tracking**.

---

### Download

- **[Latest Windows build (.zip)](https://github.com/ysz7/Arcforge/releases/latest)**
- **[Direct link for v1.1.1 (.zip)](https://github.com/ysz7/Arcforge/releases/download/v1.1.1/Arcforge-1.1.1.zip)**


### Safety & limits in Open Beta

- Arcforge focuses on **reading and visualizing** your codebase.
- It is **safe to use for inspection** of existing projects.
- For now, consider it a **companion for understanding and planning**, not a full-blown refactoring engine for massive production monoliths.

If you run into edge cases or performance issues on large projects, please share feedback with project details (size, tech stack, symptoms).

---

### License

See the `LICENSE` file for details.