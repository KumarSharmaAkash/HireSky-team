const { systemPreferences, shell } = require('electron');
const logger = require('../core/logger').createServiceLogger('PERMISSIONS');

// macOS-only: Windows/Linux have no equivalent TCC-style gate for mic/screen
// capture at the OS level, so every check here is a no-op (reports
// 'granted') off Darwin rather than a false "permission needed" nag.
class PermissionsService {
  constructor() {
    this._pollTimer = null;
    this._lastScreenStatus = null;
  }

  isMac() {
    return process.platform === 'darwin';
  }

  getMicrophoneStatus() {
    if (!this.isMac()) return 'granted';
    try {
      return systemPreferences.getMediaAccessStatus('microphone');
    } catch (e) {
      logger.warn('getMediaAccessStatus(microphone) failed', { error: e.message });
      return 'not-determined';
    }
  }

  getScreenStatus() {
    if (!this.isMac()) return 'granted';
    try {
      return systemPreferences.getMediaAccessStatus('screen');
    } catch (e) {
      logger.warn('getMediaAccessStatus(screen) failed', { error: e.message });
      return 'not-determined';
    }
  }

  getStatus() {
    return {
      microphone: this.getMicrophoneStatus(),
      screen: this.getScreenStatus(),
    };
  }

  // Microphone CAN show a real native prompt on macOS. Screen recording
  // cannot be requested programmatically — the only path is System
  // Settings, which openScreenRecordingSettings() opens directly.
  async requestMicrophone() {
    if (!this.isMac()) return true;
    try {
      return await systemPreferences.askForMediaAccess('microphone');
    } catch (e) {
      logger.warn('askForMediaAccess(microphone) failed', { error: e.message });
      return false;
    }
  }

  openMicrophoneSettings() {
    if (!this.isMac()) return;
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
  }

  openScreenRecordingSettings() {
    if (!this.isMac()) return;
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  }

  // Polls screen-recording status (the one permission macOS never notifies
  // the app about directly) and invokes onChange(status) whenever it flips —
  // this is what lets the UI auto-continue the moment the user grants it in
  // System Settings, without a manual "I'm done" click.
  startWatching(onChange, intervalMs = 1500) {
    this.stopWatching();
    if (!this.isMac()) return;
    this._lastScreenStatus = this.getScreenStatus();
    this._pollTimer = setInterval(() => {
      const current = this.getStatus();
      if (current.screen !== this._lastScreenStatus) {
        this._lastScreenStatus = current.screen;
        try { onChange(current); } catch (e) { logger.warn('onChange handler failed', { error: e.message }); }
      }
    }, intervalMs);
  }

  stopWatching() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }
}

module.exports = new PermissionsService();
