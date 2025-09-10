/**
 * Virtual Scrolling Implementation for Performance Optimization
 * Renders only visible items to handle large lists efficiently
 */

window.VirtualScroll = {
  // Configuration
  config: {
    itemHeight: 80, // Approximate height of each item
    bufferSize: 5,  // Number of items to render outside viewport
    scrollThreshold: 50 // Pixels before edge to trigger render
  },

  // State
  state: {
    container: null,
    items: [],
    visibleRange: { start: 0, end: 0 },
    scrollTop: 0,
    containerHeight: 0,
    isVirtualized: false
  },

  /**
   * Initialize virtual scrolling
   * @param {HTMLElement} container - Scroll container
   * @param {Array} items - Items to render
   * @param {Function} renderCallback - Function to render items
   */
  init(container, items, renderCallback) {
    this.state.container = container;
    this.state.items = items;
    this.renderCallback = renderCallback;
    
    // Enable virtual scrolling only for large lists
    this.state.isVirtualized = items.length > 50;
    
    if (!this.state.isVirtualized) {
      // For small lists, render normally
      this.renderCallback(items);
      return;
    }
    
    // Set up virtual scrolling
    this.setupVirtualScroll();
  },

  /**
   * Set up virtual scrolling
   */
  setupVirtualScroll() {
    const container = this.state.container;
    
    // Create viewport wrapper
    const viewport = document.createElement('div');
    viewport.className = 'virtual-viewport';
    viewport.style.position = 'relative';
    viewport.style.height = '100%';
    viewport.style.overflow = 'auto';
    
    // Create content spacer
    const spacer = document.createElement('div');
    spacer.className = 'virtual-spacer';
    spacer.style.height = `${this.state.items.length * this.config.itemHeight}px`;
    
    // Create items container
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'virtual-items';
    itemsContainer.style.position = 'absolute';
    itemsContainer.style.top = '0';
    itemsContainer.style.left = '0';
    itemsContainer.style.right = '0';
    
    // Structure the DOM
    viewport.appendChild(spacer);
    viewport.appendChild(itemsContainer);
    container.innerHTML = '';
    container.appendChild(viewport);
    
    // Set up scroll listener with throttling
    let scrollTimeout;
    viewport.addEventListener('scroll', () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        scrollTimeout = null;
        this.handleScroll(viewport, itemsContainer);
      }, 16); // ~60fps
    });
    
    // Initial render
    this.state.containerHeight = viewport.clientHeight;
    this.handleScroll(viewport, itemsContainer);
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.state.containerHeight = viewport.clientHeight;
      this.handleScroll(viewport, itemsContainer);
    });
  },

  /**
   * Handle scroll event
   * @param {HTMLElement} viewport - Viewport element
   * @param {HTMLElement} itemsContainer - Items container
   */
  handleScroll(viewport, itemsContainer) {
    const scrollTop = viewport.scrollTop;
    const containerHeight = this.state.containerHeight;
    
    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / this.config.itemHeight) - this.config.bufferSize);
    const endIndex = Math.min(
      this.state.items.length - 1,
      Math.ceil((scrollTop + containerHeight) / this.config.itemHeight) + this.config.bufferSize
    );
    
    // Check if we need to update
    if (startIndex === this.state.visibleRange.start && endIndex === this.state.visibleRange.end) {
      return;
    }
    
    // Update state
    this.state.visibleRange = { start: startIndex, end: endIndex };
    this.state.scrollTop = scrollTop;
    
    // Render visible items
    this.renderVisibleItems(itemsContainer, startIndex, endIndex);
  },

  /**
   * Render visible items
   * @param {HTMLElement} container - Container for items
   * @param {number} startIndex - Start index
   * @param {number} endIndex - End index
   */
  renderVisibleItems(container, startIndex, endIndex) {
    const visibleItems = this.state.items.slice(startIndex, endIndex + 1);
    
    // Position container
    container.style.transform = `translateY(${startIndex * this.config.itemHeight}px)`;
    
    // Render items
    this.renderCallback(visibleItems, container, startIndex);
  },

  /**
   * Update items list
   * @param {Array} items - New items list
   */
  updateItems(items) {
    this.state.items = items;
    
    if (!this.state.isVirtualized && items.length > 50) {
      // Switch to virtual scrolling
      this.state.isVirtualized = true;
      this.setupVirtualScroll();
    } else if (this.state.isVirtualized && items.length <= 50) {
      // Switch back to normal rendering
      this.state.isVirtualized = false;
      this.state.container.innerHTML = '';
      this.renderCallback(items);
    } else if (this.state.isVirtualized) {
      // Update virtual scroll
      const viewport = this.state.container.querySelector('.virtual-viewport');
      const spacer = viewport.querySelector('.virtual-spacer');
      const itemsContainer = viewport.querySelector('.virtual-items');
      
      spacer.style.height = `${items.length * this.config.itemHeight}px`;
      this.handleScroll(viewport, itemsContainer);
    } else {
      // Normal render
      this.renderCallback(items);
    }
  },

  /**
   * Scroll to item
   * @param {number} index - Item index to scroll to
   */
  scrollToItem(index) {
    if (!this.state.isVirtualized) return;
    
    const viewport = this.state.container.querySelector('.virtual-viewport');
    if (viewport) {
      viewport.scrollTop = index * this.config.itemHeight;
    }
  },

  /**
   * Get performance stats
   * @returns {Object} Performance statistics
   */
  getStats() {
    return {
      totalItems: this.state.items.length,
      visibleItems: this.state.visibleRange.end - this.state.visibleRange.start + 1,
      isVirtualized: this.state.isVirtualized,
      memoryReduction: this.state.isVirtualized 
        ? Math.round((1 - (this.state.visibleRange.end - this.state.visibleRange.start + 1) / this.state.items.length) * 100) 
        : 0
    };
  }
};