/**
 * Storage Wrapper for Chrome Storage API
 *
 * Provides a clean interface for storing and retrieving extension configuration
 * using chrome.storage.sync for cross-device synchronization.
 *
 * ⚠️ SECURITY WARNING - DEMO/DEVELOPMENT ONLY ⚠️
 * This implementation stores API tokens in UNENCRYPTED Chrome storage.
 * DO NOT use this code in production without implementing proper encryption.
 *
 * Production Requirements:
 * - Use WebCrypto API (crypto.subtle) to encrypt tokens before storage
 * - Implement key derivation (PBKDF2) from user password or device identifier
 * - Store only encrypted token + IV (initialization vector)
 * - Decrypt token only when needed, never store decrypted in memory long-term
 *
 * Security Risks of Current Implementation:
 * - Tokens stored in plain text accessible via chrome.storage API
 * - Any extension/script with storage permissions can read tokens
 * - Compromised Chrome profile exposes all tokens
 * - Chrome sync exposes tokens across devices if profile is compromised
 *
 * @see https://developer.chrome.com/docs/extensions/reference/storage/
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
 */

const Storage = {
  /**
   * Get configuration from storage
   *
   * @returns {Promise<Object>} Configuration object
   * @security ⚠️ Returns UNENCRYPTED apiToken - production must decrypt here
   */
  async getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({
        apiUrl: '',
        apiToken: '',  // ⚠️ SECURITY: Stored unencrypted (demo only)
        defaultPrivacy: 'private',
        defaultTags: [],
        enableScreenshots: true,
        defaultTTL: null,
      }, (config) => {
        resolve(config);
      });
    });
  },

  /**
   * Save configuration to storage
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async saveConfig(config) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(config, () => {
        resolve();
      });
    });
  },

  /**
   * Get API URL
   * @returns {Promise<string>}
   */
  async getApiUrl() {
    const config = await this.getConfig();
    return config.apiUrl;
  },

  /**
   * Get API Token
   * @returns {Promise<string>}
   */
  async getApiToken() {
    const config = await this.getConfig();
    return config.apiToken;
  },

  /**
   * Check if extension is configured
   * @returns {Promise<boolean>}
   */
  async isConfigured() {
    const config = await this.getConfig();
    return !!(config.apiUrl && config.apiToken);
  },

  /**
   * Clear all configuration (logout)
   * @returns {Promise<void>}
   */
  async clearConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.clear(() => {
        resolve();
      });
    });
  },

  /**
   * Update specific configuration key
   * @param {string} key - Configuration key
   * @param {any} value - Value to set
   * @returns {Promise<void>}
   */
  async updateConfig(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        resolve();
      });
    });
  },

  /**
   * Get default privacy level
   * @returns {Promise<string>}
   */
  async getDefaultPrivacy() {
    const config = await this.getConfig();
    return config.defaultPrivacy || 'private';
  },

  /**
   * Get default tags
   * @returns {Promise<Array<string>>}
   */
  async getDefaultTags() {
    const config = await this.getConfig();
    return config.defaultTags || [];
  },

  /**
   * Check if screenshots are enabled
   * @returns {Promise<boolean>}
   */
  async isScreenshotsEnabled() {
    const config = await this.getConfig();
    return config.enableScreenshots !== false;
  },
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
