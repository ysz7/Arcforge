export function generatePluginTemplate(
  destDir: string,
  opts: { id: string; name: string; author: string; accepts: 'directory' | 'file' }
): { ok: boolean; path: string };
