# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that manages clipboard history with features for saving, searching, filtering, and exporting clipboard items.

## Architecture

### Core Files
- `manifest.json`: Chrome extension configuration defining permissions (clipboardRead, clipboardWrite, storage) and entry points
- `background.js`: Service worker handling message passing between extension components 
- `popup.js`: Main UI logic for clipboard management (save, delete, favorite, search, export functionality)
- `popup.html`: Extension popup interface with modals for confirmations
- `styles.css`: Styling for the popup interface

### Data Flow
- Clipboard items stored in `chrome.storage.local` with structure: `{text, timestamp, favorite}`
- Communication between popup and background via Chrome runtime messaging
- Export functionality creates downloadable text files of clipboard history

## Development Commands

No build process required - this is a vanilla JavaScript Chrome extension. To develop:
1. Load unpacked extension in Chrome via chrome://extensions/
2. Enable Developer mode
3. Click "Load unpacked" and select this directory
4. Reload extension after changes

## Key Implementation Details

### Storage Structure
Clipboard history stored as array in chrome.storage.local:
```javascript
clipboardHistory: [{
  text: string,
  timestamp: number,
  favorite: boolean
}]
```

### Keyboard Shortcuts (in popup)
- Ctrl/Cmd + Shift + S: Save clipboard
- Ctrl/Cmd + Shift + X: Clear history  
- Ctrl/Cmd + Shift + E: Export history

### Modal Confirmations
Two confirmation modals protect data:
- Clear all history confirmation
- Delete favorited item confirmation