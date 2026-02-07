/**
 * Background Service Worker
 *
 * Coordinates communication between popup, content scripts, and API
 * Manages state and handles notifications
 */

// Constants
const SCREENSHOT_INITIAL_QUALITY = 60;     // Initial JPEG quality for screenshots
const SCREENSHOT_MIN_QUALITY = 20;         // Minimum JPEG quality before giving up
const SCREENSHOT_QUALITY_DECREMENT = 10;   // How much to reduce quality per retry
const SCREENSHOT_MAX_SIZE_BYTES = 1 * 1024 * 1024;  // 1MB maximum screenshot size

/**
 * Fetch with timeout wrapper
 * Prevents hanging requests that lock UI
 */
async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'validateToken') {
    validateToken(request.apiUrl, request.token).then(sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'saveKnowledge') {
    saveKnowledge(request.data, request.apiUrl, request.token).then(sendResponse);
    return true;
  }

  if (request.action === 'updateKnowledge') {
    updateKnowledge(request.documentId, request.data, request.apiUrl, request.token).then(sendResponse);
    return true;
  }

  if (request.action === 'captureScreenshot') {
    captureScreenshot(request.tabId).then(sendResponse);
    return true;
  }

  if (request.action === 'showNotification') {
    showNotification(request.title, request.message, request.type);
    sendResponse({ success: true });
    return false;
  }
});

/**
 * Validate API token
 */
async function validateToken(apiUrl, token) {
  try {
    const response = await fetchWithTimeout(`${apiUrl}/api/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        valid: false,
        error: response.status === 401 ? 'Invalid token' : `Server error: ${response.status}`
      };
    }

    const data = await response.json();
    return { valid: true, user: data };

  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false, error: error.message || 'Network error' };
  }
}

/**
 * Save knowledge to API
 */
async function saveKnowledge(data, apiUrl, token) {
  try {
    // Capture screenshot if requested with size validation
    let screenshotDataUrl = null;
    if (data.captureScreenshot && data.tabId) {
      try {
        // Start with initial quality
        let quality = SCREENSHOT_INITIAL_QUALITY;
        let screenshotResult = await chrome.tabs.captureVisibleTab(null, {
          format: 'jpeg',
          quality: quality,
        });

        // Retry with lower quality if too large
        while (screenshotResult.length > SCREENSHOT_MAX_SIZE_BYTES && quality > SCREENSHOT_MIN_QUALITY) {
          quality -= SCREENSHOT_QUALITY_DECREMENT;
          console.log(`Screenshot too large (${screenshotResult.length} bytes), retrying with quality ${quality}`);
          screenshotResult = await chrome.tabs.captureVisibleTab(null, {
            format: 'jpeg',
            quality: quality,
          });
        }

        // Only include screenshot if within size limit
        if (screenshotResult.length <= SCREENSHOT_MAX_SIZE_BYTES) {
          screenshotDataUrl = screenshotResult;
        } else {
          console.warn(`Screenshot still too large (${screenshotResult.length} bytes) even at minimum quality, skipping`);
        }
      } catch (error) {
        console.error('Screenshot capture error:', error);
        // Continue without screenshot
      }
    }

    // Build the payload
    const payload = {
      title: data.title,
      content_type: 'text',
      content: data.content,
      description: data.description || '',
      tags: [...(data.tags || []), 'source:clipper'], // Always add source:clipper tag
      privacy_level: data.privacy || 'private',
    };

    // Add custom notes as separate field (not appended to description)
    if (data.notes) {
      payload.notes = data.notes;
    }

    // Add TTL (always include to indicate explicit user choice)
    // null = Keep forever, number = expire after X hours
    payload.ttl_hours = data.ttl;

    // Add source URL to external_source_identifier field
    if (data.url) {
      payload.external_source_identifier = data.url;
    }

    // Add author if available
    if (data.author) {
      payload.author = data.author;
    }

    // Add thumbnail/favicon URLs if available
    if (data.ogImage) {
      payload.thumbnail_url = data.ogImage;
    }
    if (data.favicon) {
      payload.favicon_url = data.favicon;
    }

    // Add auto-refresh settings
    if (data.autoRefreshEnabled) {
      payload.auto_refresh_enabled = true;
      payload.refresh_interval_minutes = data.refreshIntervalMinutes;
    }

    // Add screenshot if captured
    if (screenshotDataUrl) {
      payload.screenshot = screenshotDataUrl;
      console.log('Screenshot captured, size:', screenshotDataUrl.length, 'bytes');
    }

    // Make API request with timeout
    const response = await fetchWithTimeout(`${apiUrl}/api/v1/knowledge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      let errorMessage = 'Failed to save';

      if (response.status === 401) {
        errorMessage = 'Authentication failed';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Token requires knowledge:create scope';
      } else if (response.status === 422 && errorData.errors) {
        const errors = Object.values(errorData.errors).flat();
        errorMessage = errors.join(', ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }

      return { success: false, error: errorMessage };
    }

    const responseData = await response.json();

    // Show success notification
    showNotification(
      'Saved Successfully',
      `"${data.title}" has been added to your knowledge system`,
      'success'
    );

    return { success: true, data: responseData.data };

  } catch (error) {
    console.error('Save knowledge error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Update existing knowledge document
 */
async function updateKnowledge(documentId, data, apiUrl, token) {
  try {
    // Build the payload for update
    const payload = {
      title: data.title,
      description: data.description || '',
      tags: [...(data.tags || []), 'source:clipper'], // Always add source:clipper tag
      privacy_level: data.privacy || 'private',
    };

    // Add custom notes as separate field (not appended to description)
    if (data.notes) {
      payload.notes = data.notes;
    }

    // Add TTL (always include to indicate explicit user choice)
    // null = Keep forever, number = expire after X hours
    payload.ttl_hours = data.ttl;

    // Add auto-refresh settings
    if (data.autoRefreshEnabled !== undefined) {
      payload.auto_refresh_enabled = data.autoRefreshEnabled;
      if (data.autoRefreshEnabled && data.refreshIntervalMinutes) {
        payload.refresh_interval_minutes = data.refreshIntervalMinutes;
      }
    }

    // Make API request with timeout
    const response = await fetchWithTimeout(`${apiUrl}/api/v1/knowledge/${documentId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      let errorMessage = 'Failed to update';

      if (response.status === 401) {
        errorMessage = 'Authentication failed';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied';
      } else if (response.status === 422 && errorData.errors) {
        const errors = Object.values(errorData.errors).flat();
        errorMessage = errors.join(', ');
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }

      return { success: false, error: errorMessage };
    }

    const responseData = await response.json();

    // Show success notification
    showNotification(
      'Updated Successfully',
      `"${data.title}" has been updated`,
      'success'
    );

    return { success: true, data: responseData.data };

  } catch (error) {
    console.error('Update knowledge error:', error);
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Capture screenshot of current tab
 */
async function captureScreenshot(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90,
    });

    return { success: true, dataUrl };

  } catch (error) {
    console.error('Screenshot capture error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Show browser notification
 */
function showNotification(title, message, type = 'info') {
  // Check if notifications API is available
  if (!chrome.notifications) {
    console.log('Notification:', title, message);
    return;
  }

  const iconPath = type === 'success'
    ? 'icons/icon-128.png'
    : 'icons/icon-128.png';

  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconPath,
    title: title,
    message: message,
    priority: 1,
  });
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open settings page on first install
    console.log('PromptlyAgent Knowledge Clipper installed');
  }
});
