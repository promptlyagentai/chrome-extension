/**
 * Screenshot Capture Utility
 *
 * Handles capturing screenshots of the current tab using Chrome's tabs API
 */

const Screenshot = {
  /**
   * Capture screenshot of the current visible tab
   * @param {number} tabId - Tab ID to capture
   * @returns {Promise<string|null>} Base64 PNG data URL or null if failed
   */
  async capture(tabId) {
    try {
      // Capture visible tab as PNG data URL
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 90,
      });

      return dataUrl;
    } catch (error) {
      console.error('Screenshot capture error:', error);
      return null;
    }
  },

  /**
   * Capture and compress screenshot
   * @param {number} tabId - Tab ID to capture
   * @param {number} maxWidth - Maximum width for resizing
   * @returns {Promise<string|null>} Compressed base64 PNG data URL or null
   */
  async captureAndCompress(tabId, maxWidth = 1200) {
    try {
      const dataUrl = await this.capture(tabId);
      if (!dataUrl) return null;

      // Compress/resize the image
      return await this.compressImage(dataUrl, maxWidth);
    } catch (error) {
      console.error('Screenshot compression error:', error);
      return null;
    }
  },

  /**
   * Compress and resize image
   * @param {string} dataUrl - Original image data URL
   * @param {number} maxWidth - Maximum width
   * @returns {Promise<string>} Compressed image data URL
   */
  async compressImage(dataUrl, maxWidth) {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if width exceeds maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed data URL
        const compressedDataUrl = canvas.toDataURL('image/png', 0.8);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        console.error('Error loading image for compression');
        resolve(dataUrl); // Return original on error
      };

      img.src = dataUrl;
    });
  },

  /**
   * Convert data URL to blob
   * @param {string} dataUrl - Image data URL
   * @returns {Blob} Image blob
   */
  dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const contentType = parts[0].match(/:(.*?);/)[1];
    const raw = atob(parts[1]);
    const rawLength = raw.length;
    const uint8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uint8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uint8Array], { type: contentType });
  },

  /**
   * Get screenshot file size in KB
   * @param {string} dataUrl - Image data URL
   * @returns {number} Size in KB
   */
  getSize(dataUrl) {
    const base64str = dataUrl.split(',')[1];
    const decoded = atob(base64str);
    return Math.round(decoded.length / 1024);
  },
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Screenshot;
}
