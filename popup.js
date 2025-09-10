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

    // Stats toggle button
    const statsToggle = document.getElementById('stats-toggle');
    if (statsToggle) {
      statsToggle.addEventListener('click', toggleStatsView);
    }

    // Search input is handled by UI module with debouncing
  }

  /**
   * Toggle between clipboard and stats view
   */
  function toggleStatsView() {
    const clipboardView = document.getElementById('clipboard-view');
    const statsView = document.getElementById('stats-view');
    const statsToggle = document.getElementById('stats-toggle');
    const searchFilter = document.querySelector('.search-filter');
    
    if (statsView.style.display === 'none') {
      // Show stats view
      clipboardView.style.display = 'none';
      statsView.style.display = 'block';
      statsToggle.textContent = 'BACK';
      statsToggle.classList.add('active');
      
      // Hide search/filter in stats view
      if (searchFilter) searchFilter.style.display = 'none';
      
      // Load statistics
      loadStatistics();
      loadTagManagement();
    } else {
      // Show clipboard view
      statsView.style.display = 'none';
      clipboardView.style.display = 'block';
      statsToggle.textContent = 'STATS';
      statsToggle.classList.remove('active');
      
      // Show search/filter
      if (searchFilter) searchFilter.style.display = 'flex';
    }
  }

  /**
   * Load and display statistics
   */
  async function loadStatistics() {
    const history = await Storage.getClipboardHistory();
    const stats = await Storage.getStorageStats();
    const tags = await Storage.getAllTags();
    
    // Update overview cards
    document.getElementById('total-items').textContent = history.length;
    document.getElementById('storage-used').textContent = stats?.usagePercentage + '%' || '0%';
    document.getElementById('total-tags').textContent = tags.length;
    document.getElementById('favorite-count').textContent = history.filter(item => item.favorite).length;
    
    // Draw activity chart
    drawActivityChart(history);
    
    // Draw type distribution
    drawTypeChart(history);
  }

  /**
   * Draw 7-day activity chart
   */
  function drawActivityChart(history) {
    const canvas = document.getElementById('activity-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const now = new Date();
    const days = [];
    const counts = [];
    
    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayCount = history.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= date && itemDate < nextDate;
      }).length;
      
      days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      counts.push(dayCount);
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw bars
    const maxCount = Math.max(...counts, 1);
    const barWidth = 50;
    const barSpacing = 15;
    const chartHeight = 120;
    
    counts.forEach((count, index) => {
      const barHeight = (count / maxCount) * chartHeight;
      const x = index * (barWidth + barSpacing) + 20;
      const y = chartHeight - barHeight + 10;
      
      // Draw bar
      ctx.fillStyle = '#3ecf8e';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw count label
      ctx.fillStyle = '#888888';
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(count, x + barWidth / 2, y - 5);
      
      // Draw day label
      ctx.fillText(days[index], x + barWidth / 2, chartHeight + 25);
    });
  }

  /**
   * Draw content type distribution
   */
  function drawTypeChart(history) {
    const typeChart = document.getElementById('type-chart');
    if (!typeChart) return;
    
    // Count types
    const typeCounts = {};
    history.forEach(item => {
      const type = item.type || 'text';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Create simple CSS pie chart
    const total = history.length || 1;
    const colors = {
      text: '#3ecf8e',
      url: '#3b82f6',
      email: '#f59e0b',
      code: '#8b5cf6',
      phone: '#ec4899'
    };
    
    let html = '<div class="pie-chart-container">';
    let currentAngle = 0;
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      const percentage = (count / total) * 100;
      const color = colors[type] || '#888888';
      
      html += `
        <div class="pie-slice" style="
          --percentage: ${percentage};
          --color: ${color};
          --rotation: ${currentAngle};
        "></div>
      `;
      currentAngle += percentage * 3.6; // Convert to degrees
    });
    
    html += '</div><div class="pie-legend">';
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      const percentage = Math.round((count / total) * 100);
      const color = colors[type] || '#888888';
      html += `
        <div class="legend-item">
          <span class="legend-color" style="background: ${color}"></span>
          <span class="legend-label">${type}</span>
          <span class="legend-value">${percentage}%</span>
        </div>
      `;
    });
    
    html += '</div>';
    typeChart.innerHTML = html;
  }

  /**
   * Load tag management
   */
  async function loadTagManagement() {
    const tags = await Storage.getAllTags();
    const tagColors = await Storage.getTagColors();
    const tagList = document.getElementById('tag-list');
    
    if (!tagList) return;
    
    if (tags.length === 0) {
      tagList.innerHTML = '<div class="empty-tags">No tags created yet</div>';
      return;
    }
    
    tagList.innerHTML = '';
    tags.forEach(tag => {
      const tagItem = document.createElement('div');
      tagItem.classList.add('tag-manager-item');
      tagItem.style.backgroundColor = tagColors[tag] || '#3ecf8e';
      
      const tagText = document.createElement('span');
      tagText.textContent = tag;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('tag-delete-btn');
      deleteBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      deleteBtn.addEventListener('click', async () => {
        await removeTag(tag);
        await loadTagManagement();
        await loadTagFilters();
        UI.showToast(`Tag "${tag}" removed`, 'success');
      });
      
      tagItem.appendChild(tagText);
      tagItem.appendChild(deleteBtn);
      tagList.appendChild(tagItem);
    });
  }

  /**
   * Remove a tag from system
   */
  async function removeTag(tagToRemove) {
    // Remove from global tags list
    const tags = await Storage.getAllTags();
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    await Storage.set(Storage.KEYS.TAGS, updatedTags);
    
    // Remove from tag colors
    const colors = await Storage.getTagColors();
    delete colors[tagToRemove];
    await Storage.set(Storage.KEYS.TAG_COLORS, colors);
    
    // Remove from all items
    const history = await Storage.getClipboardHistory();
    history.forEach(item => {
      if (item.tags) {
        item.tags = item.tags.filter(tag => tag !== tagToRemove);
      }
    });
    await Storage.set(Storage.KEYS.CLIPBOARD_HISTORY, history);
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