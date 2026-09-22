// electron-builder `afterPack` hook.
//
// electron-builder's own signing pass (@electron/osx-sign) already walks and
// signs every Mach-O binary under Contents/**, deepest-first, automatically —
// but it explicitly SKIPS symlinked directories. A conventional Python venv
// would have entire subtrees silently unsigned that way; our bundled runtime
// (see scripts/build-whisper-runtime.sh) is a python-build-standalone
// "install_only" tree specifically because it's real files, not symlinks —
// but this hook is a defensive safety net in case that ever changes, and it
// runs BEFORE electron-builder's own signing pass (afterPack fires before
// signing; afterSign fires after), so anything it signs here just gets
// harmlessly re-signed (--force) by the main pass afterward.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MACHO_MAGIC = new Set([
  0xfeedface, 0xfeedfacf, // 32/64-bit Mach-O
  0xcefaedfe, 0xcffaedfe, // byte-swapped
  0xcafebabe, 0xbebafeca, // fat/universal binary
]);

function isMachO(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return MACHO_MAGIC.has(buf.readUInt32BE(0));
  } catch (_) {
    return false;
  }
}

function collectBinaries(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    let real = full;
    let isDir = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        const target = fs.realpathSync(full);
        const stat = fs.statSync(target);
        isDir = stat.isDirectory();
        real = target;
      } catch (_) {
        continue; // broken symlink
      }
    }
    if (isDir) {
      collectBinaries(full, out); // recurse via the original (symlinked) path
    } else if (isMachO(real)) {
      out.push(full);
    }
  }
  return out;
}

function depth(p) {
  return p.split(path.sep).length;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const identity = process.env.CSC_NAME;
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false' || !identity) {
    console.log('[mac-sign] No signing identity configured — skipping nested-binary pre-sign (dev build).');
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const runtimeDir = path.join(context.appOutDir, appName, 'Contents', 'Resources', 'whisper-runtime');
  if (!fs.existsSync(runtimeDir)) {
    console.log('[mac-sign] No bundled whisper-runtime found — nothing to pre-sign.');
    return;
  }

  const binaries = collectBinaries(runtimeDir).sort((a, b) => depth(b) - depth(a));
  const entitlements = path.resolve(__dirname, '..', '..', 'build', 'entitlements.mac.inherit.plist');

  for (const bin of binaries) {
    try {
      execFileSync('codesign', [
        '--force', '--options', 'runtime', '--timestamp',
        '--entitlements', entitlements,
        '--sign', identity, bin,
      ], { stdio: 'inherit' });
    } catch (error) {
      console.warn(`[mac-sign] Failed to pre-sign ${bin}: ${error.message}`);
    }
  }
  console.log(`[mac-sign] Pre-signed ${binaries.length} nested binaries under ${runtimeDir}`);
};
