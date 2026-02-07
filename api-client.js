/**
 * Knowledge API Client
 *
 * Handles all communication with the PromptlyAgent Knowledge API
 */

class KnowledgeApiClient {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
  }

  /**
   * Validate token and check connection
   * @returns {Promise<{valid: boolean, user: Object|null, error: string|null}>}
   */
  async validate() {
    try {
      const response = await fetch(`${this.apiUrl}/api/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, user: null, error: 'Invalid token or token expired' };
        }
        return { valid: false, user: null, error: `Server error: ${response.status}` };
      }

      const data = await response.json();
      return { valid: true, user: data, error: null };
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false, user: null, error: error.message || 'Network error' };
    }
  }

  /**
   * Save extracted content to knowledge system
   * @param {Object} data - Knowledge data
   * @param {string} data.title - Page title
   * @param {string} data.url - Page URL
   * @param {string} data.content - Extracted content
   * @param {string} data.description - Page description
   * @param {string} data.notes - Custom user notes
   * @param {Array<string>} data.tags - Tags
   * @param {string} data.privacy - Privacy level (private|public)
   * @param {number|null} data.ttl - TTL in hours
   * @returns {Promise<{success: boolean, data: Object|null, error: string|null}>}
   */
  async saveKnowledge(data) {
    try {
      // Build the payload
      const payload = {
        title: data.title,
        content_type: 'text',
        content: data.content,
        description: data.description || '',
        tags: data.tags || [],
        privacy_level: data.privacy || 'private',
      };

      // Add custom notes to description if provided
      if (data.notes) {
        payload.description = payload.description
          ? `${payload.description}\n\n---\nNotes: ${data.notes}`
          : `Notes: ${data.notes}`;
      }

      // Add TTL if provided
      if (data.ttl) {
        payload.ttl_hours = data.ttl;
      }

      // Add source URL as metadata in description
      if (data.url) {
        payload.description = payload.description
          ? `${payload.description}\n\nSource: ${data.url}`
          : `Source: ${data.url}`;
      }

      const response = await fetch(`${this.apiUrl}/api/v1/knowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return { success: false, data: null, error: 'Authentication failed. Please check your token.' };
        }

        if (response.status === 403) {
          return { success: false, data: null, error: 'Permission denied. Token requires knowledge:create scope.' };
        }

        if (response.status === 422) {
          const errors = errorData.errors || {};
          const errorMessages = Object.values(errors).flat().join(', ');
          return { success: false, data: null, error: `Validation error: ${errorMessages}` };
        }

        return {
          success: false,
          data: null,
          error: errorData.message || `Server error: ${response.status}`
        };
      }

      const responseData = await response.json();
      return { success: true, data: responseData.data, error: null };

    } catch (error) {
      console.error('Save knowledge error:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Get extension configuration (optional endpoint)
   * @returns {Promise<{success: boolean, config: Object|null, error: string|null}>}
   */
  async getExtensionConfig() {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/knowledge/extension/config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return { success: false, config: null, error: `Server error: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, config: data.data, error: null };

    } catch (error) {
      // This endpoint is optional, so we don't throw errors
      console.warn('Extension config endpoint not available:', error);
      return { success: false, config: null, error: null };
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KnowledgeApiClient;
}
