/**
 * Main popup script for Clipboard Manager
 * Refactored with modular architecture
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize storage
  await Storage.init();
  
  // Initialize UI
  UI.init();
  
  // Main application state
  let clipboardHistory = [];

  /**
   * Initialize the popup
   */
  async function init() {
    try {
      // Load clipboard history
      await loadClipboardHistory();
      
      // Set up event listeners
      setupEventListeners();
      
      // Load tag filters
      await loadTagFilters();
      
      // Initialize UI with current settings
      const settings = await Storage.getSettings();
      applySettings(settings);
      
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      UI.showToast('Failed to load clipboard manager', 'error');
    }
  }

  /**
   * Load clipboard history from storage
   */
  async function loadClipboardHistory() {
    try {
      clipboardHistory = await Storage.getClipboardHistory();
      
      // Add content type detection to items without it
      clipboardHistory = clipboardHistory.map(item => ({
        ...item,
        type: item.type || Utils.detectContentType(item.text)
      }));
      
      // Make history available globally for UI keyboard navigation
      window.clipboardHistory = clipboardHistory;
      
      UI.renderClipboardHistory(clipboardHistory);
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
      UI.showToast('Failed to load history', 'error');
    }
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Save button
    const saveButton = document.getElementById('save-clipboard');
    if (saveButton) {
      saveButton.addEventListener('click', handleSaveClipboard);
    }

    // Clear button
    const clearButton = document.getElementById('clear-clipboard');
    if (clearButton) {
      clearButton.addEventListener('click', handleClearClipboard);
    }

    // Export button
    const exportButton = document.getElementById('export-clipboard');
    if (exportButton) {
      exportButton.addEventListener('click', handleExportClipboard);
    }

    // Import button
    const importButton = document.getElementById('import-clipboard');
    if (importButton) {
      importButton.addEventListener('click', handleImportClipboard);
    }

    // Bulk mode toggle button
    const bulkModeButton = document.getElementById('bulk-mode-toggle');
    if (bulkModeButton) {
      bulkModeButton.addEventListener('click', () => {
        UI.toggleBulkMode();
        bulkModeButton.textContent = UI.state.bulkMode ? 'CANCEL' : 'SELECT';
        bulkModeButton.classList.toggle('active', UI.state.bulkMode);
      });
    }

    // Bulk operation buttons
    const bulkSelectAll = document.getElementById('bulk-select-all');
    if (bulkSelectAll) {
      bulkSelectAll.addEventListener('click', () => UI.selectAll());
    }

    const bulkSelectNone = document.getElementById('bulk-select-none');
    if (bulkSelectNone) {
      bulkSelectNone.addEventListener('click', () => UI.selectNone());
    }

    const bulkPin = document.getElementById('bulk-pin');
    if (bulkPin) {
      bulkPin.addEventListener('click', () => UI.bulkPin());
    }

    const bulkFavorite = document.getElementById('bulk-favorite');
    if (bulkFavorite) {
      bulkFavorite.addEventListener('click', () => UI.bulkFavorite());
    }

    const bulkDelete = document.getElementById('bulk-delete');
    if (bulkDelete) {
      bulkDelete.addEventListener('click', () => UI.bulkDelete());
    }

    // Filter dropdown
    const filterDropdown = document.getElementById('filter-dropdown');
    if (filterDropdown) {
      filterDropdown.addEventListener('change', (e) => {
        UI.handleFilterChange(e.target.value);
      });
    }

    // Search input is handled by UI module with debouncing
  }

  /**
   * Handle save clipboard
   */
  async function handleSaveClipboard() {
    try {
      // Read current clipboard content
      const text = await navigator.clipboard.readText();
      
      if (!text || text.trim() === '') {
        UI.showToast('Clipboard is empty', 'info');
        return;
      }

      // Validate text length
      if (text.length > 10000) {
        UI.showToast('Text too long (max 10,000 characters)', 'error');
        return;
      }

      // Create new clipboard item
      const newItem = {
        text: text.trim(),
        timestamp: Date.now(),
        favorite: false,
        type: Utils.detectContentType(text)
      };

      // Save to storage
      const success = await Storage.saveClipboardItem(newItem);
      
      if (success) {
        UI.showToast('Clipboard saved!', 'success');
        await loadClipboardHistory();
      } else {
        UI.showToast('Failed to save clipboard', 'error');
      }
    } catch (error) {
      console.error('Failed to save clipboard:', error);
      
      // Handle permission errors
      if (error.name === 'NotAllowedError') {
        UI.showToast('Clipboard access denied. Please check permissions.', 'error');
      } else {
        UI.showToast('Failed to read clipboard', 'error');
      }
    }
  }

  /**
   * Handle clear clipboard
   */
  function handleClearClipboard() {
    const clearModal = document.getElementById('clearConfirmationModal');
    if (!clearModal) return;

    // Show modal with animation
    clearModal.style.display = 'block';
    clearModal.classList.add('show');

    const confirmClearButton = document.getElementById('confirmClear');
    const cancelClearButton = document.getElementById('cancelClear');

    // Remove existing listeners to avoid duplicates
    const newConfirmButton = confirmClearButton.cloneNode(true);
    const newCancelButton = cancelClearButton.cloneNode(true);
    confirmClearButton.parentNode.replaceChild(newConfirmButton, confirmClearButton);
    cancelClearButton.parentNode.replaceChild(newCancelButton, cancelClearButton);

    // Add new listeners
    newConfirmButton.addEventListener('click', async () => {
      closeModal(clearModal);
      
      const success = await Storage.clearClipboardHistory(false, true); // Keep pinned items
      if (success) {
        UI.showToast('Clipboard history cleared (pinned items kept)', 'success');
        await loadClipboardHistory();
      } else {
        UI.showToast('Failed to clear history', 'error');
      }
    });

    newCancelButton.addEventListener('click', () => {
      closeModal(clearModal);
    });
  }

  /**
   * Close modal with animation
   */
  function closeModal(modal) {
    modal.classList.remove('show');
    modal.classList.add('closing');
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('closing');
    }, 200);
  }

  /**
   * Handle export clipboard
   */
  async function handleExportClipboard() {
    try {
      if (clipboardHistory.length === 0) {
        UI.showToast('No history to export', 'info');
        return;
      }

      // Get export data
      const exportData = await Storage.exportHistory('txt');
      
      if (!exportData) {
        UI.showToast('Failed to export history', 'error');
        return;
      }

      // Create and download file
      const blob = new Blob([exportData], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clipboard_history_${new Date().getTime()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      UI.showToast('Clipboard history exported!', 'success');
    } catch (error) {
      console.error('Failed to export clipboard:', error);
      UI.showToast('Failed to export history', 'error');
    }
  }

  /**
   * Handle import clipboard
   */
  function handleImportClipboard() {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.json';
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        let importedItems = [];
        
        // Try to parse as JSON first
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            importedItems = data;
          } else if (data.clipboardHistory && Array.isArray(data.clipboardHistory)) {
            importedItems = data.clipboardHistory;
          }
        } catch {
          // If not JSON, treat as plain text (one item per line)
          const lines = text.split('\n').filter(line => line.trim());
          importedItems = lines.map(line => ({
            text: line.trim(),
            timestamp: Date.now() + Math.random(), // Ensure unique timestamps
            favorite: false
          }));
        }
        
        // Validate and save items
        if (importedItems.length > 0) {
          const validItems = importedItems.filter(item => 
            item.text && typeof item.text === 'string' && item.text.trim()
          );
          
          for (const item of validItems) {
            // Ensure required fields
            if (!item.timestamp) item.timestamp = Date.now() + Math.random();
            if (item.favorite === undefined) item.favorite = false;
            item.type = item.type || Utils.detectContentType(item.text);
            
            await Storage.saveClipboardItem(item);
          }
          
          UI.showToast(`Imported ${validItems.length} items`, 'success');
          await loadClipboardHistory();
        } else {
          UI.showToast('No valid items found in file', 'error');
        }
      } catch (error) {
        console.error('Failed to import clipboard:', error);
        UI.showToast('Failed to import file', 'error');
      }
    });
    
    // Trigger file picker
    fileInput.click();
  }

  /**
   * Load tag filters into dropdown
   */
  async function loadTagFilters() {
    const tags = await Storage.getAllTags();
    const tagFiltersGroup = document.getElementById('tag-filters');
    
    if (tagFiltersGroup && tags.length > 0) {
      // Clear existing tag options
      tagFiltersGroup.innerHTML = '';
      
      // Add tag options
      tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = `tag:${tag}`;
        option.textContent = tag;
        tagFiltersGroup.appendChild(option);
      });
    }
  }

  /**
   * Apply settings to UI
   */
  function applySettings(settings) {
    // Apply theme if dark mode is implemented in future
    // Apply other settings as needed
  }

  /**
   * Handle messages from background script
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'clipboardUpdated') {
      loadClipboardHistory();
    }
  });

  // Initialize the popup
  init();
});