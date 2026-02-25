// Minimal enhancement layer for the Arcforge landing page.
// - Fetches updates.json to display the latest version and wire the download button.
// - Provides smooth scrolling for in-page navigation links.

(function () {
  const manifestUrl = "updates.json";

  const downloadButton = document.querySelector("[data-download-button]");
  const downloadMeta = document.querySelector("[data-download-meta]");

  if (downloadMeta) {
    downloadMeta.textContent = "Fetching latest version…";
  }

  if (window.fetch) {
    fetch(manifestUrl, { cache: "no-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((manifest) => {
        if (!manifest || !manifest.latestVersion) {
          if (downloadMeta) {
            downloadMeta.textContent = "Latest version information is unavailable.";
          }
          return;
        }

        const latest = manifest.latestVersion;
        const primaryDownload = Array.isArray(manifest.downloads)
          ? manifest.downloads.find((d) => d.os === "windows" && d.arch === "x64") ||
            manifest.downloads[0]
          : null;

        if (downloadMeta) {
          downloadMeta.textContent = `Latest stable: ${latest}`;
        }

        const fallbackUrl =
          manifest.changelogUrl ||
          "https://github.com/ysz7/Arcforge/releases/latest";

        const targetUrl =
          (primaryDownload && primaryDownload.url) ? primaryDownload.url : fallbackUrl;

        if (downloadButton && targetUrl) {
          downloadButton.setAttribute("href", targetUrl);
        }
      })
      .catch(() => {
        if (downloadMeta) {
          downloadMeta.textContent = "Offline – using cached version.";
        }
      });
  } else if (downloadMeta) {
    downloadMeta.textContent = "Using default download link.";
  }

  // Simple smooth scroll for anchors within the page.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement)) return;
    const href = target.getAttribute("href");
    if (!href || !href.startsWith("#")) return;

    const el = document.querySelector(href);
    if (!el) return;

    event.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();

