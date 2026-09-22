#!/usr/bin/env node
// Runs before `electron-builder --mac`. Purely informational — never fails
// the build. If Apple signing/notarization credentials aren't present in
// the environment, prints a loud warning (electron-builder's own warnings
// are easy to miss in a long build log) and forces
// CSC_IDENTITY_AUTO_DISCOVERY=false so a stray, unrelated keychain identity
// never gets picked up by accident for what should be an unsigned dev build.
const hasSigningCert = !!process.env.CSC_LINK;
const hasNotarizeCreds = !!(
  process.env.APPLE_API_KEY ||
  (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD)
);

if (!hasSigningCert || !hasNotarizeCreds) {
  console.warn('\n' + '='.repeat(72));
  console.warn('  UNSIGNED / UN-NOTARIZED DEV BUILD');
  console.warn('  This .dmg WILL trigger Gatekeeper "unidentified developer" or');
  console.warn('  "damaged" warnings on any other Mac. DO NOT DISTRIBUTE THIS BUILD.');
  console.warn('');
  console.warn('  To produce a real release build, set:');
  console.warn('    CSC_LINK, CSC_KEY_PASSWORD            (Developer ID .p12)');
  console.warn('    APPLE_API_KEY, APPLE_API_KEY_ID,       (notarization —');
  console.warn('    APPLE_API_ISSUER                        recommended)');
  console.warn('  or: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD (alternative)');
  console.warn('='.repeat(72) + '\n');
  if (!hasSigningCert) {
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
  }
}

module.exports = { hasSigningCert, hasNotarizeCreds };
