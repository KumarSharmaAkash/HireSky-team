// electron-builder `afterSign` hook. Runs after electron-builder's own
// sign + (built-in) notarize + staple pass completes. Just validates the
// staple actually landed on the .app and fails loud if not — cheap
// insurance so a broken notarization never silently ships.
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (!process.env.CSC_LINK || !(process.env.APPLE_API_KEY || process.env.APPLE_ID)) {
    return; // unsigned/un-notarized dev build — nothing to validate
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  try {
    execFileSync('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' });
    console.log('[mac-sign] Notarization staple verified on', appPath);
  } catch (error) {
    throw new Error(
      `Notarization staple validation failed for ${appPath}. ` +
      `The app was signed but notarization/stapling did not complete correctly — ` +
      `do not distribute this build. (${error.message})`
    );
  }
};
