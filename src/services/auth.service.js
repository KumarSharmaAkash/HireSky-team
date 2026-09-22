const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const logger = require('../core/logger').createServiceLogger('AUTH');

// Fixed demo credentials for this phase — the real backend auth system
// will replace only _verifyCredentials() below; nothing else in this file
// (storage, IPC shape, isAuthenticated/logout) should need to change then.
const DEMO_EMAIL = 'demo@hiresky.app';
const DEMO_PASSWORD = 'HireSkyDemo@123';

class AuthService {
  constructor() {
    this._authenticated = false;
  }

  get _statePath() {
    return path.join(app.getPath('userData'), '.auth-state');
  }

  _verifyCredentials(email, password) {
    return (
      typeof email === 'string' &&
      typeof password === 'string' &&
      email.trim().toLowerCase() === DEMO_EMAIL &&
      password === DEMO_PASSWORD
    );
  }

  login(email, password) {
    if (!this._verifyCredentials(email, password)) {
      return { success: false, error: 'Incorrect email or password.' };
    }
    this._authenticated = true;
    this._persist();
    logger.info('Login succeeded');
    return { success: true };
  }

  logout() {
    this._authenticated = false;
    try {
      if (fs.existsSync(this._statePath)) fs.unlinkSync(this._statePath);
    } catch (e) {
      logger.warn('Failed to remove persisted auth state', { error: e.message });
    }
    logger.info('Logged out');
    return { success: true };
  }

  isAuthenticated() {
    if (this._authenticated) return true;
    return this._loadPersisted();
  }

  // Encrypts a small marker (never the password) with safeStorage, which is
  // backed by the OS Keychain on macOS — this is why it's safe to leave on
  // disk, unlike a plaintext flag file.
  _persist() {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn('safeStorage unavailable — login will not persist across restarts');
        return;
      }
      const payload = JSON.stringify({ authenticated: true, issuedAt: new Date().toISOString() });
      const encrypted = safeStorage.encryptString(payload);
      fs.writeFileSync(this._statePath, encrypted, { mode: 0o600 });
    } catch (e) {
      logger.warn('Failed to persist auth state', { error: e.message });
    }
  }

  _loadPersisted() {
    try {
      if (!fs.existsSync(this._statePath) || !safeStorage.isEncryptionAvailable()) {
        return false;
      }
      const encrypted = fs.readFileSync(this._statePath);
      const decrypted = safeStorage.decryptString(encrypted);
      const payload = JSON.parse(decrypted);
      this._authenticated = !!payload.authenticated;
      return this._authenticated;
    } catch (e) {
      logger.warn('Failed to read persisted auth state', { error: e.message });
      return false;
    }
  }
}

module.exports = new AuthService();
