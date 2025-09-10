/**
 * UI management for Clipboard Manager
 */

const UI = {
  // DOM element references
  elements: {
    list: null,
    saveButton: null,
    clearButton: null,
    exportButton: null,
    searchInput: null,
    filterDropdown: null,
    clearModal: null,
    deleteModal: null
  },

  // UI state
  state: {
    currentFilter: '',
    searchQuery: '',
    selectedItems: new Set(),
    isLoading: false,
    selectedIndex: -1,
    bulkMode: false,
    checkedItems: new Set(),
    expandedPreviews: new Set()
  },

  /**
   * Initialize UI
   */
  init() {
    this.cacheElements();
    this.attachEventListeners();
  },

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements.list = document.getElementById('clipboard-list');
    this.elements.saveButton = document.getElementById('save-clipboard');
    this.elements.clearButton = document.getElementById('clear-clipboard');
    this.elements.exportButton = document.getElementById('export-clipboard');
    this.elements.searchInput = document.getElementById('search-input');
    this.elements.filterDropdown = document.getElementById('filter-dropdown');
    this.elements.clearModal = document.getElementById('clearConfirmationModal');
    this.elements.deleteModal = document.getElementById('confirmationModal');
  },

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Debounced search
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', 
        Utils.debounce((e) => this.handleSearch(e.target.value), 300)
      );
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
  },

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardNavigation(e) {
    const items = this.elements.list?.querySelectorAll('.clipboard-item');
    if (!items || items.length === 0) return;

    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.state.selectedIndex = Math.min(this.state.selectedIndex + 1, items.length - 1);
        this.updateSelectedItem(items);
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        this.state.selectedIndex = Math.max(this.state.selectedIndex - 1, 0);
        this.updateSelectedItem(items);
        break;
      
      case 'Enter':
        if (this.state.selectedIndex >= 0 && this.state.selectedIndex < items.length) {
          e.preventDefault();
          const selectedItem = items[this.state.selectedIndex];
          const timestamp = parseInt(selectedItem.dataset.timestamp);
          const item = this.findItemByTimestamp(timestamp);
          if (item) {
            this.handleCopyItem(item);
          }
        }
        break;
      
      case 'Delete':
        if (this.state.selectedIndex >= 0 && this.state.selectedIndex < items.length) {
          e.preventDefault();
          const selectedItem = items[this.state.selectedIndex];
          const timestamp = parseInt(selectedItem.dataset.timestamp);
          const item = this.findItemByTimestamp(timestamp);
          if (item) {
            this.handleDeleteItem(item);
          }
        }
        break;
      
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.elements.searchInput?.focus();
        }
        break;
    }
  },

  /**
   * Update selected item visual state
   * @param {NodeList} items - List items
   */
  updateSelectedItem(items) {
    items.forEach((item, index) => {
      if (index === this.state.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  },

  /**
   * Find item by timestamp
   * @param {number} timestamp - Item timestamp
   * @returns {Object|null} Clipboard item
   */
  findItemByTimestamp(timestamp) {
    const history = window.clipboardHistory || [];
    return history.find(item => item.timestamp === timestamp);
  },

  /**
   * Show toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type (success, error, info)
   */
  showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-remove after animation
    setTimeout(() => {
      toast.remove();
    }, 3000);
  },

  /**
   * Create clipboard item element
   * @param {Object} item - Clipboard item
   * @returns {HTMLElement} List item element
   */
  createClipboardItem(item) {
    const listItem = document.createElement('li');
    listItem.classList.add('clipboard-item');
    listItem.dataset.timestamp = item.timestamp;
    listItem.dataset.type = item.type || 'text';
    if (item.pinned) {
      listItem.dataset.pinned = 'true';
    }

    // Add checkbox for bulk selection
    if (this.state.bulkMode) {
      listItem.classList.add('bulk-mode');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('bulk-checkbox');
      checkbox.checked = this.state.checkedItems.has(item.timestamp);
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.handleCheckboxChange(item.timestamp, e.target.checked);
      });
      listItem.appendChild(checkbox);
    }

    // Create content based on type
    const contentElement = this.createContentElement(item);
    listItem.appendChild(contentElement);

    // Add metadata
    const metaElement = this.createMetaElement(item);
    listItem.appendChild(metaElement);

    // Add tags
    if (item.tags && item.tags.length > 0) {
      const tagsElement = this.createTagsElement(item);
      listItem.appendChild(tagsElement);
    } else {
      // Add empty tag container with just the add button
      const tagsElement = this.createTagsElement(item);
      listItem.appendChild(tagsElement);
    }

    // Add action buttons
    const actionsElement = this.createActionsElement(item);
    listItem.appendChild(actionsElement);

    // Add preview pane if expanded
    if (this.state.expandedPreviews.has(item.timestamp)) {
      const previewPane = this.createPreviewPane(item);
      listItem.appendChild(previewPane);
    }

    return listItem;
  },

  /**
   * Create content element based on item type
   * @param {Object} item - Clipboard item
   * @returns {HTMLElement} Content element
   */
  createContentElement(item) {
    const container = document.createElement('div');
    container.classList.add('content-container');

    const type = item.type || Utils.detectContentType(item.text);
    
    // Add type icon
    const icon = document.createElement('span');
    icon.classList.add('type-icon');
    icon.innerHTML = this.getTypeIcon(type);
    container.appendChild(icon);

    // Add content with smart truncation
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('text-content-wrapper');
    
    const content = document.createElement('span');
    content.classList.add('text-content');
    
    const isLongText = item.text.length > 100;
    
    if (type === 'url') {
      const favicon = document.createElement('img');
      favicon.src = Utils.getFaviconUrl(item.text);
      favicon.classList.add('favicon');
      favicon.onerror = () => { favicon.style.display = 'none'; };
      content.appendChild(favicon);
      
      const link = document.createElement('span');
      link.textContent = Utils.truncateText(item.text, 80);
      link.classList.add('url-text');
      content.appendChild(link);
    } else {
      if (isLongText) {
        content.textContent = Utils.truncateText(item.text, 100);
        content.dataset.fullText = item.text;
        content.dataset.truncated = 'true';
        
        // Add show more/less button
        const toggleBtn = document.createElement('button');
        toggleBtn.classList.add('show-more-btn');
        toggleBtn.textContent = 'Show more';
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleTextExpansion(content, toggleBtn);
        });
        contentWrapper.appendChild(content);
        contentWrapper.appendChild(toggleBtn);
      } else {
        content.textContent = item.text;
        contentWrapper.appendChild(content);
      }
    }
    
    content.addEventListener('click', () => this.handleCopyItem(item));
    if (!isLongText || type === 'url') {
      container.appendChild(content);
    } else {
      container.appendChild(contentWrapper);
    }

    return container;
  },

  /**
   * Toggle text expansion
   * @param {HTMLElement} content - Content element
   * @param {HTMLElement} button - Toggle button
   */
  toggleTextExpansion(content, button) {
    const isTruncated = content.dataset.truncated === 'true';
    
    if (isTruncated) {
      content.textContent = content.dataset.fullText;
      content.dataset.truncated = 'false';
      button.textContent = 'Show less';
    } else {
      content.textContent = Utils.truncateText(content.dataset.fullText, 100);
      content.dataset.truncated = 'true';
      button.textContent = 'Show more';
    }
  },

  /**
   * Create metadata element
   * @param {Object} item - Clipboard item
   * @returns {HTMLElement} Metadata element
   */
  createMetaElement(item) {
    const meta = document.createElement('div');
    meta.classList.add('item-meta');

    // Timestamp
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    // Use relative time by default, will be updated based on settings
    timestamp.textContent = Utils.formatTimestamp(
      item.timestamp, 
      false // Default to absolute time for now
    );
    meta.appendChild(timestamp);

    // Text stats
    const stats = Utils.getTextStats(item.text);
    const statsElement = document.createElement('span');
    statsElement.classList.add('text-stats');
    statsElement.textContent = `${stats.words} ${stats.words === 1 ? 'word' : 'words'}`;
    meta.appendChild(statsElement);

    return meta;
  },

  /**
   * Create tags element
   * @param {Object} item - Clipboard item
   * @returns {HTMLElement} Tags element
   */
  createTagsElement(item) {
    const tagsContainer = document.createElement('div');
    tagsContainer.classList.add('item-tags');
    
    // Display existing tags if any
    if (item.tags && item.tags.length > 0) {
      // Load tag colors asynchronously
      Storage.getTagColors().then(tagColors => {
        item.tags.forEach(tag => {
          const tagElement = document.createElement('span');
          tagElement.classList.add('tag');
          tagElement.textContent = tag;
          tagElement.style.backgroundColor = tagColors[tag] || '#3ecf8e';
          
          // Add remove button
          const removeBtn = document.createElement('button');
          removeBtn.classList.add('tag-remove');
          removeBtn.innerHTML = '×';
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleRemoveTag(item.timestamp, tag);
          });
          
          tagElement.appendChild(removeBtn);
          // Insert before the add button if it exists
          const addBtn = tagsContainer.querySelector('.add-tag-btn');
          if (addBtn) {
            tagsContainer.insertBefore(tagElement, addBtn);
          } else {
            tagsContainer.appendChild(tagElement);
          }
        });
      });
    }
    
    // Add new tag button
    const addTagBtn = document.createElement('button');
    addTagBtn.classList.add('add-tag-btn');
    addTagBtn.innerHTML = '+ Tag';
    addTagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showTagInput(item.timestamp, addTagBtn);
    });
    
    tagsContainer.appendChild(addTagBtn);
    
    return tagsContainer;
  },

  /**
   * Show tag input
   * @param {number} timestamp - Item timestamp
   * @param {HTMLElement} button - Add tag button
   */
  async showTagInput(timestamp, button) {
    // Hide button
    button.style.display = 'none';
    
    // Create input container
    const inputContainer = document.createElement('div');
    inputContainer.classList.add('tag-input-container');
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('tag-input');
    input.placeholder = 'Enter tag...';
    
    // Create suggestions dropdown
    const suggestions = document.createElement('div');
    suggestions.classList.add('tag-suggestions');
    suggestions.style.display = 'none';
    
    // Load existing tags for suggestions
    const allTags = await Storage.getAllTags();
    
    // Handle input
    input.addEventListener('input', () => {
      const value = input.value.toLowerCase();
      if (value) {
        const matches = allTags.filter(tag => 
          tag.toLowerCase().includes(value)
        );
        
        if (matches.length > 0) {
          suggestions.innerHTML = '';
          matches.forEach(tag => {
            const option = document.createElement('div');
            option.classList.add('tag-suggestion');
            option.textContent = tag;
            option.addEventListener('mousedown', (e) => {
              // Use mousedown instead of click to prevent blur
              e.preventDefault();
              input.value = tag;
              suggestions.style.display = 'none';
              handleSubmit();
            });
            suggestions.appendChild(option);
          });
          suggestions.style.display = 'block';
        } else {
          suggestions.style.display = 'none';
        }
      } else {
        suggestions.style.display = 'none';
      }
    });
    
    // Handle submit
    const handleSubmit = async () => {
      const value = input.value.trim();
      if (value) {
        await this.handleAddTag(timestamp, value);
        inputContainer.remove();
        button.style.display = 'inline-block';
      }
    };
    
    // Handle enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        suggestions.style.display = 'none';
        handleSubmit();
      } else if (e.key === 'Escape') {
        inputContainer.remove();
        button.style.display = 'inline-block';
      }
    });
    
    // Handle blur - but not if clicking within the container
    input.addEventListener('blur', (e) => {
      // Delay to allow mousedown events to fire first
      setTimeout(() => {
        // Check if the new active element is within the input container
        if (!inputContainer.contains(document.activeElement) && 
            !suggestions.contains(document.activeElement)) {
          inputContainer.remove();
          button.style.display = 'inline-block';
        }
      }, 100);
    });
    
    inputContainer.appendChild(input);
    inputContainer.appendChild(suggestions);
    button.parentElement.insertBefore(inputContainer, button);
    input.focus();
  },

  /**
   * Handle add tag
   * @param {number} timestamp - Item timestamp
   * @param {string} tag - Tag to add
   */
  async handleAddTag(timestamp, tag) {
    const success = await Storage.addTagsToItem(timestamp, [tag]);
    if (success) {
      this.showToast(`Tag "${tag}" added`, 'success');
      this.refreshDisplay();
      // Trigger tag filters refresh if callback is provided
      if (this.onTagsChanged) {
        this.onTagsChanged();
      }
    } else {
      this.showToast('Failed to add tag', 'error');
    }
  },

  /**
   * Handle remove tag
   * @param {number} timestamp - Item timestamp
   * @param {string} tag - Tag to remove
   */
  async handleRemoveTag(timestamp, tag) {
    const success = await Storage.removeTagFromItem(tag, timestamp);
    if (success) {
      this.showToast(`Tag "${tag}" removed`, 'success');
      this.refreshDisplay();
      // Trigger tag filters refresh if callback is provided
      if (this.onTagsChanged) {
        this.onTagsChanged();
      }
    } else {
      this.showToast('Failed to remove tag', 'error');
    }
  },

  /**
   * Create actions element
   * @param {Object} item - Clipboard item
   * @returns {HTMLElement} Actions element
   */
  createActionsElement(item) {
    const actions = document.createElement('div');
    actions.classList.add('item-actions');

    // Preview button
    const isExpanded = this.state.expandedPreviews.has(item.timestamp);
    const previewBtn = this.createActionButton(
      isExpanded ? Icons.eyeOff : Icons.eye,
      isExpanded ? 'Hide Preview' : 'Show Preview',
      () => this.handleTogglePreview(item.timestamp)
    );
    previewBtn.classList.add('preview-btn');
    actions.appendChild(previewBtn);

    // Pin button
    const pinBtn = this.createActionButton(
      item.pinned ? Icons.pinFilled : Icons.pin,
      item.pinned ? 'Unpin' : 'Pin',
      () => this.handleTogglePin(item.timestamp)
    );
    pinBtn.classList.add('pin-btn');
    if (item.pinned) pinBtn.classList.add('active');
    actions.appendChild(pinBtn);

    // Favorite button
    const favoriteBtn = this.createActionButton(
      item.favorite ? Icons.starFilled : Icons.star,
      'Favorite',
      () => this.handleToggleFavorite(item.timestamp)
    );
    favoriteBtn.classList.add('favorite-btn');
    if (item.favorite) favoriteBtn.classList.add('active');
    actions.appendChild(favoriteBtn);

    // Delete button
    const deleteBtn = this.createActionButton(
      Icons.trash,
      'Delete',
      () => this.handleDeleteItem(item)
    );
    deleteBtn.classList.add('delete-btn');
    actions.appendChild(deleteBtn);

    return actions;
  },

  /**
   * Create action button
   * @param {string} iconSrc - Icon source
   * @param {string} tooltip - Tooltip text
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} Button element
   */
  createActionButton(iconHTML, tooltip, onClick) {
    const container = document.createElement('div');
    container.classList.add('tooltip');

    const button = document.createElement('button');
    button.classList.add('action-btn');
    button.innerHTML = iconHTML;
    button.addEventListener('click', onClick);
    container.appendChild(button);

    const tooltipText = document.createElement('span');
    tooltipText.classList.add('tooltiptext');
    tooltipText.textContent = tooltip;
    container.appendChild(tooltipText);

    return container;
  },

  /**
   * Get icon for content type
   * @param {string} type - Content type
   * @returns {string} Icon HTML
   */
  getTypeIcon(type) {
    const icons = {
      url: Icons.link,
      email: Icons.mail,
      phone: Icons.phone,
      code: Icons.code,
      text: Icons.text
    };
    return icons[type] || icons.text;
  },

  /**
   * Render clipboard history
   * @param {Array} history - Clipboard history
   */
  renderClipboardHistory(history) {
    if (!this.elements.list) return;

    // Apply filters
    let filteredHistory = this.filterHistory(history);

    // Show empty state if needed
    if (filteredHistory.length === 0) {
      this.elements.list.innerHTML = '';
      this.showEmptyState();
      return;
    }

    // Store filtered history for virtual scrolling
    this.filteredHistory = filteredHistory;

    // Check if we should use virtual scrolling (>50 items)
    if (filteredHistory.length > 50) {
      this.initVirtualScrolling(filteredHistory);
    } else {
      // For small lists, render normally
      this.renderAllItems(filteredHistory);
    }
  },

  /**
   * Initialize virtual scrolling for large lists
   * @param {Array} items - Items to render
   */
  initVirtualScrolling(items) {
    // For now, just render all items normally since virtual scrolling
    // is causing issues with the popup's fixed height constraint
    // We'll revisit this with a better implementation later
    this.renderAllItems(items);
    
    // Removed toast notification - not needed
  },

  /**
   * Render all items (for small lists)
   * @param {Array} items - Items to render
   */
  renderAllItems(items) {
    this.elements.list.innerHTML = '';
    this.elements.list.style.position = '';
    this.elements.list.classList.remove('virtual-scrolling');
    
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const listItem = this.createClipboardItem(item);
      fragment.appendChild(listItem);
    });
    this.elements.list.appendChild(fragment);
  },

  /**
   * Filter history based on current state
   * @param {Array} history - Clipboard history
   * @returns {Array} Filtered history
   */
  filterHistory(history) {
    let filtered = [...history];

    // Apply search filter
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.text.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (this.state.currentFilter.startsWith('tag:')) {
      // Tag filter
      const tag = this.state.currentFilter.substring(4);
      filtered = filtered.filter(item => 
        item.tags && item.tags.includes(tag)
      );
    } else {
      switch (this.state.currentFilter) {
        case 'favorites':
          filtered = filtered.filter(item => item.favorite);
          break;
        case 'recent':
          // Keep pinned at top, sort rest by recent
          filtered.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.timestamp - a.timestamp;
          });
          break;
        case 'oldest':
          // Keep pinned at top, sort rest by oldest
          filtered.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return a.timestamp - b.timestamp;
          });
          break;
        case 'urls':
          filtered = filtered.filter(item => 
            (item.type || Utils.detectContentType(item.text)) === 'url'
          );
          break;
        case 'code':
          filtered = filtered.filter(item => 
            (item.type || Utils.detectContentType(item.text)) === 'code'
          );
          break;
      }
    }

    // After all filters, ensure pinned items stay at top (for non-sorted filters)
    if (this.state.currentFilter !== 'recent' && this.state.currentFilter !== 'oldest') {
      filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.timestamp - a.timestamp;
      });
    }

    return filtered;
  },

  /**
   * Show empty state
   */
  showEmptyState() {
    const emptyMessage = document.createElement('li');
    emptyMessage.classList.add('empty-state');
    
    if (this.state.searchQuery) {
      emptyMessage.innerHTML = `
        <div class="empty-icon">${Icons.search}</div>
        <div class="empty-text">No results found for "${this.state.searchQuery}"</div>
      `;
    } else if (this.state.currentFilter === 'favorites') {
      emptyMessage.innerHTML = `
        <div class="empty-icon">${Icons.star}</div>
        <div class="empty-text">No favorites yet</div>
        <div class="empty-subtext">Click the star icon on any item to add it to favorites</div>
      `;
    } else {
      emptyMessage.innerHTML = `
        <div class="empty-icon">${Icons.clipboard}</div>
        <div class="empty-text">No clipboard history</div>
        <div class="empty-subtext">Copy some text and click "Save" to get started</div>
      `;
    }
    
    this.elements.list.appendChild(emptyMessage);
  },

  /**
   * Handle search input
   * @param {string} query - Search query
   */
  handleSearch(query) {
    this.state.searchQuery = query;
    this.refreshDisplay();
  },

  /**
   * Handle filter change
   * @param {string} filter - Filter value
   */
  handleFilterChange(filter) {
    this.state.currentFilter = filter;
    this.refreshDisplay();
  },

  /**
   * Handle copy item
   * @param {Object} item - Item to copy
   */
  async handleCopyItem(item) {
    const success = await Utils.copyToClipboard(item.text);
    if (success) {
      this.showToast('Copied to clipboard!', 'success');
    } else {
      this.showToast('Failed to copy', 'error');
    }
  },

  /**
   * Handle toggle favorite
   * @param {number} timestamp - Item timestamp
   */
  async handleToggleFavorite(timestamp) {
    const isFavorite = await Storage.toggleFavorite(timestamp);
    this.showToast(
      isFavorite ? 'Added to favorites' : 'Removed from favorites',
      'success'
    );
    this.refreshDisplay();
  },

  /**
   * Handle toggle pin
   * @param {number} timestamp - Item timestamp
   */
  async handleTogglePin(timestamp) {
    const isPinned = await Storage.togglePin(timestamp);
    this.showToast(
      isPinned ? 'Item pinned' : 'Item unpinned',
      'success'
    );
    this.refreshDisplay();
  },

  /**
   * Handle toggle preview
   * @param {number} timestamp - Item timestamp
   */
  handleTogglePreview(timestamp) {
    if (this.state.expandedPreviews.has(timestamp)) {
      this.state.expandedPreviews.delete(timestamp);
    } else {
      this.state.expandedPreviews.add(timestamp);
    }
    this.refreshDisplay();
  },

  /**
   * Create preview pane
   * @param {Object} item - Clipboard item
   * @returns {HTMLElement} Preview pane element
   */
  createPreviewPane(item) {
    const previewPane = document.createElement('div');
    previewPane.classList.add('preview-pane');
    
    const type = item.type || Utils.detectContentType(item.text);
    
    // Create formatted preview based on type
    const previewContent = document.createElement('div');
    previewContent.classList.add('preview-content');
    
    if (type === 'code') {
      // Code preview with syntax highlighting (basic)
      const codeBlock = document.createElement('pre');
      const codeElement = document.createElement('code');
      codeElement.textContent = item.text;
      codeElement.classList.add('language-javascript'); // Default to JS
      codeBlock.appendChild(codeElement);
      previewContent.appendChild(codeBlock);
      
      // Add copy full code button
      const copyBtn = document.createElement('button');
      copyBtn.classList.add('preview-copy-btn');
      copyBtn.innerHTML = Icons.copy + ' Copy Full Code';
      copyBtn.addEventListener('click', () => this.handleCopyItem(item));
      previewContent.appendChild(copyBtn);
    } else if (type === 'url') {
      // URL preview with link
      const linkPreview = document.createElement('div');
      linkPreview.classList.add('link-preview');
      
      const link = document.createElement('a');
      link.href = item.text;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.text;
      linkPreview.appendChild(link);
      
      const openBtn = document.createElement('button');
      openBtn.classList.add('preview-action-btn');
      openBtn.innerHTML = Icons.link + ' Open Link';
      openBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: item.text });
      });
      linkPreview.appendChild(openBtn);
      
      previewContent.appendChild(linkPreview);
    } else {
      // Regular text preview with markdown support
      const textPreview = document.createElement('div');
      textPreview.classList.add('text-preview');
      
      // Basic markdown rendering (bold, italic, code)
      let formattedText = item.text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
        .replace(/\n/g, '<br>'); // Line breaks
      
      textPreview.innerHTML = formattedText;
      previewContent.appendChild(textPreview);
    }
    
    // Add stats bar
    const statsBar = document.createElement('div');
    statsBar.classList.add('preview-stats');
    
    const stats = Utils.getTextStats(item.text);
    statsBar.innerHTML = `
      <span>${stats.characters} characters</span>
      <span>${stats.words} ${stats.words === 1 ? 'word' : 'words'}</span>
      <span>${stats.lines} ${stats.lines === 1 ? 'line' : 'lines'}</span>
    `;
    
    previewPane.appendChild(previewContent);
    previewPane.appendChild(statsBar);
    
    return previewPane;
  },

  /**
   * Handle delete item
   * @param {Object} item - Item to delete
   */
  handleDeleteItem(item) {
    if (item.favorite) {
      this.showDeleteConfirmation(item);
    } else {
      this.deleteItem(item.timestamp);
    }
  },

  /**
   * Show delete confirmation modal
   * @param {Object} item - Item to delete
   */
  showDeleteConfirmation(item) {
    if (!this.elements.deleteModal) return;
    
    // Show modal with animation
    this.elements.deleteModal.style.display = 'block';
    this.elements.deleteModal.classList.add('show');
    
    const confirmBtn = document.getElementById('confirmDelete');
    const cancelBtn = document.getElementById('cancelDelete');
    
    const closeModalWithAnimation = () => {
      this.elements.deleteModal.classList.remove('show');
      this.elements.deleteModal.classList.add('closing');
      setTimeout(() => {
        this.elements.deleteModal.style.display = 'none';
        this.elements.deleteModal.classList.remove('closing');
      }, 200);
    };
    
    const confirmHandler = () => {
      closeModalWithAnimation();
      this.deleteItem(item.timestamp);
      confirmBtn.removeEventListener('click', confirmHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
    };
    
    const cancelHandler = () => {
      closeModalWithAnimation();
      confirmBtn.removeEventListener('click', confirmHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
    };
    
    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cancelHandler);
  },

  /**
   * Delete item
   * @param {number} timestamp - Item timestamp
   */
  async deleteItem(timestamp) {
    const success = await Storage.deleteClipboardItem(timestamp);
    if (success) {
      this.showToast('Item deleted', 'success');
      this.refreshDisplay();
    } else {
      this.showToast('Failed to delete item', 'error');
    }
  },

  /**
   * Refresh display
   */
  async refreshDisplay() {
    const history = await Storage.getClipboardHistory();
    // Update global clipboard history for other functions
    window.clipboardHistory = history;
    this.renderClipboardHistory(history);
  },

  /**
   * Show loading state with skeleton loaders
   */
  showLoading() {
    this.state.isLoading = true;
    if (this.elements.list) {
      // Create skeleton loaders
      const skeletons = [];
      for (let i = 0; i < 3; i++) {
        const skeleton = document.createElement('li');
        skeleton.className = 'skeleton';
        skeleton.innerHTML = `
          <div class="skeleton-content">
            <div class="skeleton-line skeleton-line-full"></div>
            <div class="skeleton-line skeleton-line-short"></div>
          </div>
        `;
        skeletons.push(skeleton);
      }
      
      this.elements.list.innerHTML = '';
      skeletons.forEach(skeleton => this.elements.list.appendChild(skeleton));
    }
  },

  /**
   * Hide loading state
   */
  hideLoading() {
    this.state.isLoading = false;
  },

  /**
   * Toggle bulk mode
   */
  toggleBulkMode() {
    this.state.bulkMode = !this.state.bulkMode;
    this.state.checkedItems.clear();
    this.refreshDisplay();
    this.updateBulkToolbar();
  },

  /**
   * Handle checkbox change
   * @param {number} timestamp - Item timestamp
   * @param {boolean} checked - Checkbox state
   */
  handleCheckboxChange(timestamp, checked) {
    if (checked) {
      this.state.checkedItems.add(timestamp);
    } else {
      this.state.checkedItems.delete(timestamp);
    }
    this.updateBulkToolbar();
  },

  /**
   * Select all items
   */
  selectAll() {
    const history = window.clipboardHistory || [];
    const filtered = this.filterHistory(history);
    filtered.forEach(item => {
      this.state.checkedItems.add(item.timestamp);
    });
    this.refreshDisplay();
    this.updateBulkToolbar();
  },

  /**
   * Select none
   */
  selectNone() {
    this.state.checkedItems.clear();
    this.refreshDisplay();
    this.updateBulkToolbar();
  },

  /**
   * Update bulk toolbar
   */
  updateBulkToolbar() {
    const toolbar = document.getElementById('bulk-toolbar');
    if (!toolbar) return;

    if (this.state.bulkMode && this.state.checkedItems.size > 0) {
      toolbar.style.display = 'flex';
      const countElement = toolbar.querySelector('.bulk-count');
      if (countElement) {
        countElement.textContent = `${this.state.checkedItems.size} selected`;
      }
    } else if (this.state.bulkMode) {
      toolbar.style.display = 'flex';
      const countElement = toolbar.querySelector('.bulk-count');
      if (countElement) {
        countElement.textContent = '0 selected';
      }
    } else {
      toolbar.style.display = 'none';
    }
  },

  /**
   * Bulk delete selected items
   */
  async bulkDelete() {
    if (this.state.checkedItems.size === 0) return;

    const count = this.state.checkedItems.size;
    const confirmDelete = confirm(`Delete ${count} selected items?`);
    if (!confirmDelete) return;

    // Store items to delete
    const itemsToDelete = Array.from(this.state.checkedItems);
    
    for (const timestamp of itemsToDelete) {
      await Storage.deleteClipboardItem(timestamp);
      // Remove deleted items from selection
      this.state.checkedItems.delete(timestamp);
    }

    this.showToast(`Deleted ${count} items`, 'success');
    this.refreshDisplay();
    this.updateBulkToolbar();
  },

  /**
   * Bulk favorite selected items
   */
  async bulkFavorite() {
    if (this.state.checkedItems.size === 0) return;

    const count = this.state.checkedItems.size;
    
    for (const timestamp of this.state.checkedItems) {
      await Storage.toggleFavorite(timestamp);
    }

    // Keep items selected after favoriting
    this.showToast(`Updated ${count} items`, 'success');
    this.refreshDisplay();
    this.updateBulkToolbar();
  },

  /**
   * Bulk pin selected items
   */
  async bulkPin() {
    if (this.state.checkedItems.size === 0) return;

    const count = this.state.checkedItems.size;
    
    for (const timestamp of this.state.checkedItems) {
      await Storage.togglePin(timestamp);
    }

    // Keep items selected after pinning
    this.showToast(`Updated ${count} items`, 'success');
    this.refreshDisplay();
    this.updateBulkToolbar();
  }
};

// Make UI available globally for Chrome extension
window.UI = UI;