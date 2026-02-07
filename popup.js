/**
 * Popup Logic and Form Handling
 *
 * Manages the popup interface, form submission, and user interactions
 */

// State
let currentPageData = null;
let currentTab = null;
let currentDocumentId = null; // Track saved document for updates

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  // Check if extension is configured
  const isConfigured = await Storage.isConfigured();

  if (isConfigured) {
    // Show save screen and extract page data
    await showSaveScreen();
  } else {
    // Show configuration screen
    showConfigScreen();
  }

  // Setup event listeners
  setupEventListeners();
});

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Config form
  document.getElementById('config-form').addEventListener('submit', handleConfigSubmit);
  document.getElementById('get-token-link').addEventListener('click', handleGetToken);

  // Save form
  document.getElementById('save-form').addEventListener('submit', handleSaveSubmit);
  document.getElementById('settings-btn').addEventListener('click', handleSettings);

  // Auto-refresh toggle
  document.getElementById('auto-refresh-enabled').addEventListener('change', function() {
    const refreshOptions = document.getElementById('refresh-options');
    refreshOptions.style.display = this.checked ? 'block' : 'none';
  });

  // Back button
  document.getElementById('back-btn').addEventListener('click', handleBackToSave);
}

/**
 * Show configuration screen
 */
async function showConfigScreen(fromSettings = false) {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('save-screen').style.display = 'none';
  document.getElementById('config-screen').style.display = 'block';

  // Show/hide back button based on context
  const backBtn = document.getElementById('back-btn');
  if (fromSettings) {
    backBtn.style.display = 'flex';
  } else {
    backBtn.style.display = 'none';
  }

  // Load existing configuration if available
  const config = await Storage.getConfig();
  if (config.apiUrl) {
    document.getElementById('api-url').value = config.apiUrl;
  }
  if (config.apiToken) {
    // Show masked token (for security)
    const maskedToken = '••••••••••••••••' + config.apiToken.slice(-8);
    document.getElementById('api-token').value = maskedToken;
    document.getElementById('api-token').setAttribute('data-masked', 'true');
  }

  // Clear mask on focus
  document.getElementById('api-token').addEventListener('focus', function() {
    if (this.getAttribute('data-masked') === 'true') {
      this.value = '';
      this.removeAttribute('data-masked');
    }
  }, { once: true });
}

/**
 * Check if document already exists for this URL
 */
async function checkExistingDocument(url) {
  try {
    const config = await Storage.getConfig();

    const response = await fetch(
      `${config.apiUrl}/api/v1/knowledge/check-url?url=${encodeURIComponent(url)}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      return result.data;
    }
  } catch (error) {
    console.error('Error checking existing document:', error);
  }
  return null;
}

/**
 * Show save screen and extract page data
 */
async function showSaveScreen() {
  document.getElementById('config-screen').style.display = 'none';
  document.getElementById('save-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'block';

  try {
    // Extract page data from content script
    const response = await chrome.tabs.sendMessage(currentTab.id, {
      action: 'extractPageData'
    });

    if (response && response.success) {
      currentPageData = response.data;

      // Check if document already exists for this URL
      const existingDoc = await checkExistingDocument(currentPageData.url);

      if (existingDoc && existingDoc.exists && existingDoc.document) {
        // Document exists - load it for update
        currentDocumentId = existingDoc.document.id;
        populateSaveForm(currentPageData);

        // Populate with existing document data
        setTimeout(() => {
          fetchAndPopulateDocument(currentDocumentId);
        }, 100);

        showSuccess('save-success', 'This page is already saved. You can update it below.');
        document.getElementById('save-btn').querySelector('.btn-text').textContent = 'Update Knowledge';
      } else {
        // New document
        populateSaveForm(currentPageData);
      }

      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('save-screen').style.display = 'block';
    } else {
      throw new Error('Failed to extract page data');
    }
  } catch (error) {
    console.error('Extract error:', error);
    showError('save-error', 'Failed to extract page data. Please refresh the page and try again.');
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('save-screen').style.display = 'block';
  }
}

/**
 * Populate save form with extracted page data
 */
function populateSaveForm(pageData) {
  // Title
  document.getElementById('title').value = pageData.title || '';

  // URL display
  document.getElementById('page-url').textContent = pageData.url || '';

  // Description
  document.getElementById('description').value = pageData.description || pageData.excerpt || '';

  // Show selection badge if text was selected
  if (pageData.hasSelection) {
    document.getElementById('selection-badge').style.display = 'inline-flex';
  }

  // Content preview
  const contentLength = pageData.content ? pageData.content.length : 0;
  document.getElementById('content-length').textContent = contentLength.toLocaleString();
  document.getElementById('content-text').textContent = pageData.content || 'No content extracted';

  // Suggest tags based on keywords
  if (pageData.keywords && pageData.keywords.length > 0) {
    const suggestedTags = pageData.keywords.slice(0, 5).join(', ');
    document.getElementById('tags').placeholder = `Suggested: ${suggestedTags}`;
  }

  // Load default settings
  loadDefaultSettings();
}

/**
 * Load default settings from storage
 */
async function loadDefaultSettings() {
  const config = await Storage.getConfig();

  // Privacy
  if (config.defaultPrivacy) {
    const radio = document.querySelector(`input[name="privacy"][value="${config.defaultPrivacy}"]`);
    if (radio) radio.checked = true;
  }

  // Screenshot
  document.getElementById('screenshot').checked = config.enableScreenshots !== false;

  // Tags
  if (config.defaultTags && config.defaultTags.length > 0) {
    const existingTags = document.getElementById('tags').value;
    if (!existingTags) {
      document.getElementById('tags').value = config.defaultTags.join(', ');
    }
  }

  // TTL
  if (config.defaultTTL) {
    document.getElementById('ttl').value = config.defaultTTL;
  }
}

/**
 * Handle configuration form submission
 */
async function handleConfigSubmit(e) {
  e.preventDefault();

  const apiUrl = document.getElementById('api-url').value.trim();
  let apiToken = document.getElementById('api-token').value.trim();

  // Check if token is masked - if so, use the stored token
  const isMasked = document.getElementById('api-token').getAttribute('data-masked') === 'true';
  if (isMasked) {
    const config = await Storage.getConfig();
    apiToken = config.apiToken;
  }

  // Validate inputs
  if (!apiUrl || !apiToken) {
    showError('config-error', 'Please fill in all fields');
    return;
  }

  // Disable form
  const submitBtn = document.getElementById('save-config-btn');
  submitBtn.disabled = true;

  // Clear previous error
  hideError('config-error');

  try {
    // Validate token with API
    const result = await chrome.runtime.sendMessage({
      action: 'validateToken',
      apiUrl: apiUrl,
      token: apiToken
    });

    if (result.valid) {
      // Save configuration
      await Storage.saveConfig({
        apiUrl: apiUrl,
        apiToken: apiToken
      });

      // Switch to save screen
      await showSaveScreen();
    } else {
      showError('config-error', result.error || 'Invalid token or connection failed');
      submitBtn.disabled = false;
    }
  } catch (error) {
    console.error('Config validation error:', error);
    showError('config-error', 'Failed to validate configuration');
    submitBtn.disabled = false;
  }
}

/**
 * Handle get token link click
 */
async function handleGetToken(e) {
  e.preventDefault();

  const apiUrl = document.getElementById('api-url').value.trim();
  const settingsUrl = apiUrl
    ? `${apiUrl}/settings/api-tokens`
    : 'about:blank';

  chrome.tabs.create({ url: settingsUrl });
}

/**
 * Handle save form submission
 */
async function handleSaveSubmit(e) {
  e.preventDefault();

  if (!currentPageData && !currentDocumentId) {
    showError('save-error', 'No page data available');
    return;
  }

  // Get form values
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const notes = document.getElementById('notes').value.trim();
  const tagsInput = document.getElementById('tags').value.trim();
  const privacy = document.querySelector('input[name="privacy"]:checked').value;
  const ttl = document.getElementById('ttl').value;
  const captureScreenshot = document.getElementById('screenshot').checked;
  const autoRefreshEnabled = document.getElementById('auto-refresh-enabled').checked;
  const refreshInterval = document.getElementById('refresh-interval').value;

  // Validate
  if (!title) {
    showError('save-error', 'Title is required');
    return;
  }

  // Parse tags
  const tags = tagsInput
    ? tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];

  // Disable form
  const submitBtn = document.getElementById('save-btn');
  submitBtn.disabled = true;

  // Clear messages
  hideError('save-error');
  hideSuccess('save-success');

  try {
    // Get API credentials
    const config = await Storage.getConfig();

    // Prepare data
    const data = {
      title: title,
      url: currentPageData ? currentPageData.url : null,
      content: currentPageData ? currentPageData.content : null,
      description: description,
      notes: notes,
      tags: tags,
      privacy: privacy,
      ttl: ttl ? parseInt(ttl) : null,
      author: currentPageData ? currentPageData.author : null,
      ogImage: currentPageData ? currentPageData.ogImage : null,
      favicon: currentPageData ? currentPageData.favicon : null,
      captureScreenshot: captureScreenshot,
      tabId: currentTab ? currentTab.id : null,
      autoRefreshEnabled: autoRefreshEnabled,
      refreshIntervalMinutes: autoRefreshEnabled ? parseInt(refreshInterval) : null
    };

    // Check if we're updating or creating
    const action = currentDocumentId ? 'updateKnowledge' : 'saveKnowledge';

    // Save or update via API
    const result = await chrome.runtime.sendMessage({
      action: action,
      documentId: currentDocumentId,
      data: data,
      apiUrl: config.apiUrl,
      token: config.apiToken
    });

    if (result.success) {
      // Store the document ID
      currentDocumentId = result.data.id;

      // Show success message
      showSuccess('save-success', 'Successfully saved! You can edit and update below.');

      // Change button to "Update"
      document.getElementById('save-btn').querySelector('.btn-text').textContent = 'Update Knowledge';

      // Re-enable the button for updates
      submitBtn.disabled = false;

      // Fetch the document back and populate with server data (including AI-generated tags)
      setTimeout(() => {
        fetchAndPopulateDocument(currentDocumentId);
      }, 1000);
    } else {
      showError('save-error', result.error || 'Failed to save');
      submitBtn.disabled = false;
    }
  } catch (error) {
    console.error('Save error:', error);
    showError('save-error', 'Failed to save: ' + error.message);
    submitBtn.disabled = false;
  }
}

/**
 * Handle settings button click
 */
async function handleSettings() {
  if (confirm('Return to settings? Any unsaved changes will be lost.')) {
    showConfigScreen(true);
  }
}

/**
 * Handle back button click
 */
async function handleBackToSave() {
  // Check if still configured
  const isConfigured = await Storage.isConfigured();
  if (isConfigured) {
    await showSaveScreen();
  } else {
    // Show back button hidden version
    document.getElementById('back-btn').style.display = 'none';
  }
}

/**
 * Fetch document from API and populate form
 */
async function fetchAndPopulateDocument(documentId) {
  try {
    const config = await Storage.getConfig();

    const response = await fetch(`${config.apiUrl}/api/v1/knowledge/${documentId}`, {
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      const doc = result.data;

      // Update form with server data
      document.getElementById('title').value = doc.title || '';
      document.getElementById('description').value = doc.description || '';

      // Update tags from server (may include AI-generated tags)
      const tagNames = doc.tags ? doc.tags.map(t => t.name).join(', ') : '';
      document.getElementById('tags').value = tagNames;

      // Update privacy
      const privacyRadio = document.querySelector(`input[name="privacy"][value="${doc.privacy_level}"]`);
      if (privacyRadio) privacyRadio.checked = true;

      // Update TTL
      if (doc.ttl_expires_at) {
        // Calculate hours remaining
        const expiresAt = new Date(doc.ttl_expires_at);
        const now = new Date();
        const hoursRemaining = Math.round((expiresAt - now) / (1000 * 60 * 60));

        // Try to match to closest predefined option
        const ttlSelect = document.getElementById('ttl');
        const options = {
          '24': 24,      // 1 day
          '168': 168,    // 1 week
          '720': 720,    // 1 month
          '2160': 2160,  // 3 months
          '8760': 8760   // 1 year
        };

        // Find closest match (within 10% tolerance)
        let bestMatch = '';
        let smallestDiff = Infinity;
        for (const [value, hours] of Object.entries(options)) {
          const diff = Math.abs(hoursRemaining - hours);
          const tolerance = hours * 0.1;
          if (diff < smallestDiff && diff <= tolerance) {
            smallestDiff = diff;
            bestMatch = value;
          }
        }

        ttlSelect.value = bestMatch || '';
      } else {
        // No expiration - Keep forever
        document.getElementById('ttl').value = '';
      }

      // Load notes if present in metadata
      if (doc.metadata && doc.metadata.notes) {
        document.getElementById('notes').value = doc.metadata.notes;
      } else if (doc.notes) {
        document.getElementById('notes').value = doc.notes;
      }

      // Update auto-refresh settings
      const autoRefreshEnabled = doc.auto_refresh_enabled || false;
      document.getElementById('auto-refresh-enabled').checked = autoRefreshEnabled;

      if (autoRefreshEnabled && doc.refresh_interval_minutes) {
        document.getElementById('refresh-interval').value = doc.refresh_interval_minutes;
        document.getElementById('refresh-options').style.display = 'block';
      } else {
        document.getElementById('refresh-options').style.display = 'none';
      }

      // Show info message
      showSuccess('save-success', 'Document loaded. Tags may have been enhanced by AI. Edit and update as needed.');
    }
  } catch (error) {
    console.error('Failed to fetch document:', error);
  }
}

/**
 * Show error message
 */
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError(elementId) {
  const element = document.getElementById(elementId);
  element.style.display = 'none';
}

/**
 * Show success message
 */
function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.display = 'block';
}

/**
 * Hide success message
 */
function hideSuccess(elementId) {
  const element = document.getElementById(elementId);
  element.style.display = 'none';
}
