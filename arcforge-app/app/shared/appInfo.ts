export const APP_NAME = 'Arcforge';

// Application semantic version, also used by the update checker.
export const APP_VERSION = '1.3.0';

// Public GitHub repository for the app (used in Help → About and update prompts).
export const GITHUB_REPO_URL = 'https://github.com/ysz7/Arcforge';

// URL to the JSON metadata served via GitHub Pages (see external updates project).
export const UPDATES_JSON_URL = 'https://ysz7.github.io/Arcforge/updates.json';

export interface UpdateDownloadInfo {
  os: string;
  arch: string;
  version: string;
  url: string;
  size?: number;
  releaseDate?: string;
}

export interface UpdatesJson {
  appName?: string;
  latestVersion: string;
  minimumSupportedVersion?: string;
  downloads?: UpdateDownloadInfo[];
  changelogUrl?: string;
}

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  minimumSupportedVersion: string | null;
  downloadUrl: string | null;
  changelogUrl: string | null;
  hasUpdate: boolean;
  error?: string;
}

