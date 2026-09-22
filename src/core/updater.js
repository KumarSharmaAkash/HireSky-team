const { app } = require('electron');
const logger = require('./logger').createServiceLogger('UPDATER');

// Inert scaffolding for Phase 1 — no update server exists yet (no
// `build.publish` config), so this deliberately does nothing in production
// today. It exists so wiring in a real update server later is a config
// change (`build.publish` + credentials), not an architecture change: call
// checkForUpdates() once at startup and the rest follows automatically via
// electron-updater's own event model.
function checkForUpdates() {
  if (!app.isPackaged) {
    return; // never check for updates in dev
  }

  // electron-updater infers a GitHub provider from package.json's
  // `repository` field even with no explicit `build.publish` config, which
  // would make every launch hit a releases feed that doesn't exist yet.
  // Phase 1 has no update server at all — this is deliberately inert until
  // a real one exists; enabling it later is a one-line change here plus a
  // real `build.publish` config, not an architecture change.
  const UPDATES_ENABLED = false;
  if (!UPDATES_ENABLED) {
    try {
      require('electron-updater'); // confirms the dependency is packaged correctly
      logger.debug('electron-updater present; update checks disabled for this phase');
    } catch (error) {
      logger.warn('electron-updater not available', { error: error.message });
    }
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.logger = logger;
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      logger.warn('Update check failed', { error: error.message });
    });
  } catch (error) {
    logger.warn('electron-updater not available', { error: error.message });
  }
}

module.exports = { checkForUpdates };
