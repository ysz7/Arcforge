const path = require('path');
const fs = require('fs');

/**
 * Embed app icon and version strings into the Windows exe after pack.
 * - Version strings: so taskbar context menu and Task Manager show "Arcforge" instead of "Electron".
 * - Icon: only if favicon.ico exists; otherwise exe keeps Electron icon but name is still Arcforge.
 */
exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const { rcedit } = await import('rcedit');
  const exePath = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  const iconPath = path.join(context.packager.projectDir, 'app', 'renderer', 'public', 'favicon.ico');

  const opts = {
    'version-string': {
      FileDescription: 'Arcforge',
      ProductName: 'Arcforge',
      CompanyName: '',
      LegalCopyright: '',
      InternalName: 'Arcforge',
      OriginalFilename: context.packager.appInfo.productFilename + '.exe',
    },
  };
  if (fs.existsSync(iconPath)) {
    opts.icon = iconPath;
  }

  try {
    await rcedit(exePath, opts);
  } catch (err) {
    console.warn('afterPack: rcedit failed:', err.message);
  }
};
