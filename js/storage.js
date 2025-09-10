/**
 * Storage management for Clipboard Manager
 */

const Storage = {
  // Storage keys
  KEYS: {
    CLIPBOARD_HISTORY: 'clipboardHistory',
    SETTINGS: 'settings',
    CATEGORIES: 'categories',
    TAGS: 'tags',
    TAG_COLORS: 'tagColors'
  },

  // Default settings
  DEFAULT_SETTINGS: {
    maxItems: 1000,
    autoDelete: false,
    autoDeleteDays: 30,
    theme: 'light',
    showRelativeTime: true,
    itemsPerPage: 50
  },

  /**
   * Initialize storage with default values
   * @returns {Promise<void>}
   */
  async init() {
    try {
      const result = await this.get(this.KEYS.SETTINGS);
      if (!result) {
        await this.set(this.KEYS.SETTINGS, this.DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  },

  /**
   * Get data from storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored data
   */
  async get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
        }
      });
    });
  },

  /**
   * Set data in storage
   * @param {string} key - Storage key
   * @param {any} value - Data to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Get clipboard history
   * @returns {Promise<Array>} Clipboard history
   */
  async getClipboardHistory() {
    try {
      const history = await this.get(this.KEYS.CLIPBOARD_HISTORY);
      if (!history || history.length === 0) return [];
      
      // Always return sorted with pinned items first
      history.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
      
      return history;
    } catch (error) {
      console.error('Failed to get clipboard history:', error);
      return [];
    }
  },

  /**
   * Save clipboard item
   * @param {Object} item - Clipboard item to save
   * @returns {Promise<boolean>} Success status
   */
  async saveClipboardItem(item) {
    try {
      const history = await this.getClipboardHistory();
      const settings = await this.getSettings();
      
      // Check for duplicates
      const existingIndex = history.findIndex(h => h.text === item.text);
      if (existingIndex !== -1) {
        // Update timestamp of existing item
        history[existingIndex].timestamp = Date.now();
        await this.set(this.KEYS.CLIPBOARD_HISTORY, history);
        return true;
      }
      
      // Add new item
      history.push(item);
      
      // Sort with pinned items first, then by timestamp
      history.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
      
      // Enforce max items limit while preserving pinned items
      if (history.length > settings.maxItems) {
        const pinned = history.filter(h => h.pinned);
        const unpinned = history.filter(h => !h.pinned);
        
        // Keep all pinned items and fill remaining slots with unpinned
        const remainingSlots = settings.maxItems - pinned.length;
        history = [...pinned, ...unpinned.slice(0, remainingSlots)];
      }
      
      // Auto-delete old items if enabled (but keep pinned)
      if (settings.autoDelete) {
        const cutoffDate = Date.now() - (settings.autoDeleteDays * 24 * 60 * 60 * 1000);
        const filteredHistory = history.filter(h => 
          h.pinned || h.favorite || h.timestamp > cutoffDate
        );
        await this.set(this.KEYS.CLIPBOARD_HISTORY, filteredHistory);
      } else {
        await this.set(this.KEYS.CLIPBOARD_HISTORY, history);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save clipboard item:', error);
      return false;
    }
  },

  /**
   * Delete clipboard item
   * @param {number} timestamp - Item timestamp
   * @returns {Promise<boolean>} Success status
   */
  async deleteClipboardItem(timestamp) {
    try {
      const history = await this.getClipboardHistory();
      const filteredHistory = history.filter(item => item.timestamp !== timestamp);
      
      // Maintain pinned items sorting after deletion
      filteredHistory.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
      
      await this.set(this.KEYS.CLIPBOARD_HISTORY, filteredHistory);
      return true;
    } catch (error) {
      console.error('Failed to delete clipboard item:', error);
      return false;
    }
  },

  /**
   * Clear all clipboard history
   * @param {boolean} keepFavorites - Keep favorite items
   * @param {boolean} keepPinned - Keep pinned items
   * @returns {Promise<boolean>} Success status
   */
  async clearClipboardHistory(keepFavorites = false, keepPinned = true) {
    try {
      if (keepFavorites || keepPinned) {
        const history = await this.getClipboardHistory();
        const itemsToKeep = history.filter(item => 
          (keepPinned && item.pinned) || (keepFavorites && item.favorite)
        );
        
        // Maintain sorting
        itemsToKeep.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.timestamp - a.timestamp;
        });
        
        await this.set(this.KEYS.CLIPBOARD_HISTORY, itemsToKeep);
      } else {
        await this.set(this.KEYS.CLIPBOARD_HISTORY, []);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear clipboard history:', error);
      return false;
    }
  },

  /**
   * Toggle favorite status
   * @param {number} timestamp - Item timestamp
   * @returns {Promise<boolean>} New favorite status
   */
  async toggleFavorite(timestamp) {
    try {
      const history = await this.getClipboardHistory();
      const item = history.find(h => h.timestamp === timestamp);
      if (item) {
        item.favorite = !item.favorite;
        await this.set(this.KEYS.CLIPBOARD_HISTORY, history);
        return item.favorite;
      }
      return false;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      return false;
    }
  },

  /**
   * Toggle pin status
   * @param {number} timestamp - Item timestamp
   * @returns {Promise<boolean>} New pinned status
   */
  async togglePin(timestamp) {
    try {
      const history = await this.getClipboardHistory();
      const item = history.find(h => h.timestamp === timestamp);
      if (item) {
        item.pinned = !item.pinned;
        
        // Sort with pinned items first
        history.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.timestamp - a.timestamp;
        });
        
        await this.set(this.KEYS.CLIPBOARD_HISTORY, history);
        return item.pinned;
      }
      return false;
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      return false;
    }
  },

  /**
   * Get settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    try {
      const settings = await this.get(this.KEYS.SETTINGS);
      return { ...this.DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  },

  /**
   * Update settings
   * @param {Object} updates - Settings updates
   * @returns {Promise<boolean>} Success status
   */
  async updateSettings(updates) {
    try {
      const settings = await this.getSettings();
      const newSettings = { ...settings, ...updates };
      await this.set(this.KEYS.SETTINGS, newSettings);
      return true;
    } catch (error) {
      console.error('Failed to update settings:', error);
      return false;
    }
  },

  /**
   * Export clipboard history
   * @param {string} format - Export format (json, csv, txt)
   * @returns {Promise<string>} Exported data
   */
  async exportHistory(format = 'txt') {
    try {
      const history = await this.getClipboardHistory();
      
      switch (format) {
        case 'json':
          return JSON.stringify(history, null, 2);
        
        case 'csv':
          const headers = ['Text', 'Timestamp', 'Favorite', 'Type'];
          const rows = history.map(item => [
            `"${item.text.replace(/"/g, '""')}"`,
            new Date(item.timestamp).toISOString(),
            item.favorite ? 'Yes' : 'No',
            item.type || 'text'
          ]);
          return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        
        case 'txt':
        default:
          return history.map(item => {
            const timestamp = new Date(item.timestamp).toLocaleString();
            const favorite = item.favorite ? ' ⭐' : '';
            return `${item.text} [${timestamp}]${favorite}`;
          }).join('\n\n');
      }
    } catch (error) {
      console.error('Failed to export history:', error);
      return '';
    }
  },

  /**
   * Import clipboard history
   * @param {string} data - Data to import
   * @param {string} format - Import format (json, csv)
   * @returns {Promise<boolean>} Success status
   */
  async importHistory(data, format = 'json') {
    try {
      let importedItems = [];
      
      if (format === 'json') {
        importedItems = JSON.parse(data);
      }
      
      // Validate imported items
      const validItems = importedItems.filter(item => 
        item.text && typeof item.text === 'string'
      ).map(item => ({
        text: item.text,
        timestamp: item.timestamp || Date.now(),
        favorite: item.favorite || false,
        type: item.type || Utils.detectContentType(item.text)
      }));
      
      if (validItems.length > 0) {
        const history = await this.getClipboardHistory();
        const merged = [...validItems, ...history];
        
        // Remove duplicates
        const unique = merged.reduce((acc, item) => {
          if (!acc.find(i => i.text === item.text)) {
            acc.push(item);
          }
          return acc;
        }, []);
        
        await this.set(this.KEYS.CLIPBOARD_HISTORY, unique);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  },

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Usage statistics
   */
  async getStorageStats() {
    try {
      const history = await this.getClipboardHistory();
      const settings = await this.getSettings();
      
      const totalItems = history.length;
      const favoriteItems = history.filter(item => item.favorite).length;
      const totalSize = new Blob([JSON.stringify(history)]).size;
      
      const typeBreakdown = history.reduce((acc, item) => {
        const type = item.type || 'text';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      
      return {
        totalItems,
        favoriteItems,
        totalSize,
        sizeFormatted: this.formatBytes(totalSize),
        maxItems: settings.maxItems,
        usagePercentage: Math.round((totalItems / settings.maxItems) * 100),
        typeBreakdown
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return null;
    }
  },

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Get all tags
   * @returns {Promise<Array>} Array of tag names
   */
  async getAllTags() {
    try {
      const tags = await this.get(this.KEYS.TAGS);
      return tags || [];
    } catch (error) {
      console.error('Failed to get tags:', error);
      return [];
    }
  },

  /**
   * Get tag colors mapping
   * @returns {Promise<Object>} Tag to color mapping
   */
  async getTagColors() {
    try {
      const colors = await this.get(this.KEYS.TAG_COLORS);
      return colors || {};
    } catch (error) {
      console.error('Failed to get tag colors:', error);
      return {};
    }
  },

  /**
   * Add tags to an item
   * @param {number} timestamp - Item timestamp
   * @param {Array<string>} tags - Tags to add
   * @returns {Promise<boolean>} Success status
   */
  async addTagsToItem(timestamp, tags) {
    try {
      const history = await this.getClipboardHistory();
      const item = history.find(h => h.timestamp === timestamp);
      
      if (item) {
        item.tags = item.tags || [];
        // Add new tags without duplicates
        const newTags = tags.filter(tag => !item.tags.includes(tag));
        item.tags.push(...newTags);
        
        // Update global tags list
        await this.updateGlobalTags(newTags);
        
        await this.set(this.KEYS.CLIPBOARD_HISTORY, history);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to add tags:', error);
      return false;
    }
  },

  /**
   * Remove tag from an item
   * @param {string} tag - Tag to remove
   * @param {number} timestamp - Item timestamp
   * @returns {Promise<boolean>} Success status
   */
  async removeTagFromItem(tag, timestamp) {
    try {
      const history = await this.getClipboardHistory();
      const item = history.find(h => h.timestamp === timestamp);
      
      if (item && item.tags) {
        item.tags = item.tags.filter(t => t !== tag);
        await this.set(this.KEYS.CLIPBOARD_HISTORY, history);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to remove tag:', error);
      return false;
    }
  },

  /**
   * Update global tags list
   * @param {Array<string>} newTags - New tags to add
   * @returns {Promise<void>}
   */
  async updateGlobalTags(newTags) {
    try {
      const allTags = await this.getAllTags();
      const uniqueTags = [...new Set([...allTags, ...newTags])];
      await this.set(this.KEYS.TAGS, uniqueTags);
      
      // Assign colors to new tags
      const colors = await this.getTagColors();
      const colorPalette = [
        '#3ecf8e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6',
        '#ec4899', '#10b981', '#14b8a6', '#f97316', '#06b6d4'
      ];
      
      newTags.forEach((tag) => {
        if (!colors[tag]) {
          colors[tag] = colorPalette[Object.keys(colors).length % colorPalette.length];
        }
      });
      
      await this.set(this.KEYS.TAG_COLORS, colors);
    } catch (error) {
      console.error('Failed to update global tags:', error);
    }
  },

  /**
   * Get items by tag
   * @param {string} tag - Tag to filter by
   * @returns {Promise<Array>} Filtered items
   */
  async getItemsByTag(tag) {
    try {
      const history = await this.getClipboardHistory();
      return history.filter(item => item.tags && item.tags.includes(tag));
    } catch (error) {
      console.error('Failed to get items by tag:', error);
      return [];
    }
  }
};

// Make Storage available globally for Chrome extension
window.Storage = Storage;