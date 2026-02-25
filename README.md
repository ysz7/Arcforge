## Arcforge

**Graph-based visual IDE and architecture explorer for Laravel projects.**  
This repository hosts the public landing page and the static update manifest for the Arcforge desktop app (Windows `.exe`).

Arcforge turns a Laravel codebase into a navigable graph: controllers, services, models, and dependencies become nodes and edges you can explore, generate, and refactor with more confidence.

---

### What this repository contains

- **Product website (GitHub Pages)**
  - Lives under `docs/` and is served at `https://ysz7.github.io/Arcforge/`.
  - Clean, minimal landing page (`docs/index.html`) explaining what Arcforge is and how to get the latest Windows build.
- **Static update manifest**
  - `docs/updates.json` is a small JSON file that the Arcforge desktop client reads on startup.
  - It tells the client what the latest stable version is, where to download it, and where to find the changelog.
- **Changelog (optional)**
  - `changelog.md` can be used alongside GitHub Releases to track notable changes between versions.

If you just want to try Arcforge, you do not need to understand any of the implementation details below – go to the website or GitHub Releases and download the latest installer for Windows.

---

### Where to download Arcforge

- **Latest Windows build (.exe)**  
  `https://github.com/ysz7/Arcforge/releases/latest`

- **Website / landing page**  
  `https://ysz7.github.io/Arcforge/`

Both are kept in sync via GitHub Releases and the `updates.json` manifest.

---

### How updates work (high level)

1. On startup, the Arcforge desktop app:
   - Reads its own current version (for example `1.0.0`).
   - Performs a simple HTTP GET to `https://ysz7.github.io/Arcforge/updates.json`.
2. The manifest describes:
   - `latestVersion` – the newest stable version available.
   - `minimumSupportedVersion` – the oldest client version that still understands the manifest.
   - At least one Windows x64 download entry with a direct link to the installer.
3. If a newer version is available:
   - The app shows a small prompt and, on confirmation, opens either the changelog URL or the “Latest release” page in your default browser.
4. If you are already up to date, Arcforge stays silent.

Under the hood this is just a static JSON file served from GitHub Pages – there are no background services, no telemetry, and no tracking.

---

### For maintainers

- **GitHub Pages**
  - Configure the repository to serve Pages from the `docs/` folder.
  - After each change, check that `https://ysz7.github.io/Arcforge/updates.json` returns valid JSON.

- **Publishing a new release**
  1. Create a GitHub Release (e.g. tag `v1.1.0`) with a Windows installer attached.
  2. Update `docs/updates.json`:
     - Bump `latestVersion`.
     - Optionally bump `minimumSupportedVersion`.
     - Update or add the Windows x64 entry in `downloads`.
     - Point `changelogUrl` to the new release or relevant section in `changelog.md`.
  3. Commit and push the changes to `main`.
  4. Verify that both the website and `updates.json` are served correctly via GitHub Pages.

The main Arcforge source code lives in the primary repository at `https://github.com/ysz7/Arcforge`. This companion repo is focused on the public website and the update protocol.

