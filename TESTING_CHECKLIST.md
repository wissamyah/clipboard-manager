# Clipboard Manager Testing Checklist

## 🎯 Features & Functionalities to Test

### Core Features

#### 1. **Basic Clipboard Operations**
- [ ] **Save**: Click SAVE button to save current clipboard content
  - Verify item appears at top of list
  - Check timestamp displays correctly ("1 word" vs "2 words")
  - Confirm duplicate detection works
- [ ] **Copy**: Click on any item to copy back to clipboard
  - Should show "Copied to clipboard!" toast
  - Verify clipboard contains the copied text
- [ ] **Delete**: Click trash icon to delete items
  - Regular items delete immediately
  - Favorited items show confirmation modal

#### 2. **Smart Text Truncation**
- [ ] Long text (>100 chars) shows "Show more" button
- [ ] Clicking "Show more" expands text fully
- [ ] "Show less" button collapses text back
- [ ] URLs don't get truncation button (max 80 chars)

#### 3. **Keyboard Navigation**
- [ ] **Arrow Down/Up**: Navigate through items
- [ ] **Enter**: Copy selected item to clipboard
- [ ] **Delete**: Delete selected item
- [ ] **Ctrl/Cmd + F**: Focus search input
- [ ] Selected item has green border highlight

#### 4. **Pin/Unpin Functionality**
- [ ] Click pin icon to pin items
- [ ] Pinned items stay at top with green bar
- [ ] Pinned items have darker background (#1a1f1a)
- [ ] Unpin by clicking pin icon again

#### 5. **Favorites**
- [ ] Click star icon to favorite items
- [ ] Star fills when favorited
- [ ] Filter dropdown "Favorites" shows only starred items
- [ ] Deleting favorite shows confirmation modal

#### 6. **Search & Filter**
- [ ] Search input filters items in real-time (300ms debounce)
- [ ] Filter dropdown options work:
  - All Items
  - Recent (newest first)
  - Oldest (oldest first)
  - Favorites (starred only)
- [ ] Empty state messages for no results

#### 7. **Import/Export**
- [ ] **Export**: Creates .txt file with timestamp
  - Downloads all clipboard history
  - Proper formatting in exported file
- [ ] **Import**: Accepts .txt and .json files
  - Plain text: One item per line
  - JSON: Array format or {clipboardHistory: [...]}
  - Shows success toast with item count

#### 8. **Clear History**
- [ ] Shows confirmation modal
- [ ] Modal has smooth open/close animations
- [ ] Clears all items except favorites (if implemented)
- [ ] Shows empty state after clearing

### Visual & UX

#### 9. **Theme & Styling**
- [ ] Dark theme (Supabase-inspired colors)
- [ ] Smooth hover effects on items
- [ ] Action buttons appear on hover
- [ ] Toast notifications appear/disappear smoothly

#### 10. **Content Type Detection**
- [ ] URLs show link icon and favicon
- [ ] Emails show mail icon
- [ ] Phone numbers show phone icon
- [ ] Code snippets show code icon
- [ ] Regular text shows text icon

#### 11. **Responsive Layout**
- [ ] 500x600px popup window
- [ ] Scrollable list when many items
- [ ] Fixed header and footer
- [ ] Proper spacing between elements

### Edge Cases

#### 12. **Data Validation**
- [ ] Empty clipboard shows "Clipboard is empty" toast
- [ ] Text >10,000 chars shows error
- [ ] Maximum 100 items enforced
- [ ] Old items auto-delete when limit reached

#### 13. **Error Handling**
- [ ] Storage errors show appropriate toasts
- [ ] Import errors handled gracefully
- [ ] Permission errors for clipboard access

### Performance

#### 14. **Loading States**
- [ ] Skeleton loaders appear during loading
- [ ] Smooth transitions between states
- [ ] No UI freezing with many items

## 📝 Test Scenarios

### Scenario 1: First Time User
1. Open extension with empty history
2. Copy text to clipboard
3. Click SAVE
4. See item appear with animations
5. Click item to copy back

### Scenario 2: Power User Workflow
1. Import existing clipboard file
2. Search for specific text
3. Pin important items
4. Use keyboard navigation
5. Export updated history

### Scenario 3: Organization
1. Save multiple items
2. Star favorites
3. Pin frequently used items
4. Filter by favorites
5. Clear non-essential items

## ✅ Acceptance Criteria
- All core features work without errors
- UI is responsive and smooth
- Data persists across sessions
- No console errors in developer tools
- Extension works in Chrome/Edge/Brave

## 🐛 Known Issues to Watch
- Favicon loading failures (handled gracefully)
- Large text performance
- Modal z-index conflicts
- Keyboard navigation with filters

## 📊 Test Results
- [ ] All tests passed
- [ ] Version: 1.1.0
- [ ] Tested on: [Date]
- [ ] Browser: [Chrome/Edge/Brave]
- [ ] OS: [Windows/Mac/Linux]

---

## Quick Test Commands
1. Load extension: chrome://extensions/ → Load unpacked
2. Open popup: Click extension icon
3. Console: Right-click popup → Inspect
4. Storage: chrome.storage.local.get(null, console.log)
5. Clear storage: chrome.storage.local.clear()