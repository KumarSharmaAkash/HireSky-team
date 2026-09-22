// electron-builder `afterAllArtifactBuild` hook. Optional extra hardening:
// separately notarizes + staples the .dmg file itself (not strictly
// required — the .app inside is already stapled by the built-in notarize
// step — but removes any doubt about warnings on the .dmg before it's even
// mounted). No-ops entirely on an unsigned dev build.
const { notarize } = require('@electron/notarize');

module.exports = async function afterAllArtifactBuild(buildResult) {
  const hasApiKey = !!process.env.APPLE_API_KEY;
  const hasAppleId = !!(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD);
  if (!hasApiKey && !hasAppleId) return buildResult;

  const dmgPaths = (Array.isArray(buildResult) ? buildResult : buildResult.artifactPaths || [])
    .filter((p) => typeof p === 'string' && p.endsWith('.dmg'));

  for (const appPath of dmgPaths) {
    console.log('[mac-sign] Notarizing DMG artifact:', appPath);
    const options = hasApiKey
      ? {
          appPath,
          appleApiKey: process.env.APPLE_API_KEY,
          appleApiKeyId: process.env.APPLE_API_KEY_ID,
          appleApiIssuer: process.env.APPLE_API_ISSUER,
        }
      : {
          appPath,
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        };
    await notarize(options);
  }

  return buildResult;
};
