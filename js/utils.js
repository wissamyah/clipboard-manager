/**
 * Utility functions for Clipboard Manager
 */

const Utils = {
  /**
   * Format timestamp to readable date string
   * @param {number} timestamp - Unix timestamp
   * @param {boolean} relative - Show relative time (e.g., "2 hours ago")
   * @returns {string} Formatted date string
   */
  formatTimestamp(timestamp, relative = false) {
    const date = new Date(timestamp);
    
    if (relative) {
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Detect content type from text
   * @param {string} text - Text to analyze
   * @returns {string} Content type (url, email, code, phone, text)
   */
  detectContentType(text) {
    // URL detection
    const urlPattern = /^(https?:\/\/|www\.)[^\s]+$/i;
    if (urlPattern.test(text.trim())) return 'url';
    
    // Email detection
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailPattern.test(text.trim())) return 'email';
    
    // Phone number detection
    const phonePattern = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (phonePattern.test(text.replace(/\s/g, ''))) return 'phone';
    
    // Code detection (basic)
    const codeIndicators = [
      /^(function|const|let|var|class|import|export|if|for|while)\s/,
      /[{}\[\]();]/,
      /=>/,
      /^\s*\/\//,
      /^\s*\/\*/,
      /<[^>]+>/
    ];
    
    if (codeIndicators.some(pattern => pattern.test(text))) return 'code';
    
    return 'text';
  },

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  /**
   * Sanitize text for HTML display
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Extract domain from URL
   * @param {string} url - URL to parse
   * @returns {string} Domain name
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  },

  /**
   * Get favicon URL for a domain
   * @param {string} url - URL to get favicon for
   * @returns {string} Favicon URL
   */
  getFaviconUrl(url) {
    try {
      const domain = this.extractDomain(url);
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  },

  /**
   * Debounce function to limit execution rate
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Calculate text statistics
   * @param {string} text - Text to analyze
   * @returns {object} Text statistics
   */
  getTextStats(text) {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return {
      characters: text.length,
      words: words.length,
      lines: text.split('\n').length
    };
  },

  /**
   * Copy text to clipboard using modern API
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback method
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }
};

// Make Utils available globally for Chrome extension
window.Utils = Utils;