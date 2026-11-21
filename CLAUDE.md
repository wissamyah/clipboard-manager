# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that manages clipboard history with features for saving, searching, filtering, and exporting clipboard items.

## Architecture

### Files
- `manifest.json`: MV3 config. Permissions: clipboardRead, clipboardWrite, storage, contextMenus, activeTab, scripting, sidePanel. `<all_urls>` is an *optional* host permission, requested only for automatic capture. Defines the `_execute_action` shortcut (Alt+Shift+V) and the side panel (`popup.html?panel=1`).
- `js/core.js`: Shared, DOM-free core loaded by both the popup and the service worker (`importScripts`). Exposes the global `CM`: `CM.Store` (all storage access), `CM.detectType`, `CM.normalizeItem`, `CM.enforceLimits`, schema migration.
- `background.js`: Service worker. Runs the data migration on install/update, owns the "Save selection" context menu, and registers/unregisters the capture content script to match the `autoCapture` setting and the host permission.
- `js/capture.js`: Content script for automatic capture (copy/cut events). Only registered dynamically, never listed in the manifest.
- `popup.html` / `popup.js`: The main list UI (search, filter chips, keyed row rendering, keyboard handling, bulk mode, toasts). Used for both the popup and the side panel.
- `js/panels.js`: Slide-over panels (item detail/edit, settings), the confirm dialog, theming (`CM.applyTheme`) and import/export (`CM.Data`).
- `js/icons.js`: Static inline SVG icons (`CM.icon`).
- `js/theme-init.js`: Runs in `<head>` to apply the saved theme before first paint.
- `tokens.css`: Design tokens (colours, radii, motion, fonts). Loaded by every page before its own stylesheet.
- `styles.css`: Popup and side panel styling.
- `documentation.html` / `privacy_policy.html` + `pages.css`: User docs and privacy policy, on the same tokens and theme. The privacy policy is also published publicly, so it must keep working as a standalone page with relative links only.
- `index.html`: Redirect to `documentation.html` for the GitHub Pages site (served from `main` at the repo root, which hosts the public privacy policy). Not part of the store package.

### Data flow
- Every write goes through `CM.Store` (`mutate`, `addText`, `setSettings`): one read and one write per action, serialized through a queue.
- The UI never updates itself after an action. It redraws from `chrome.storage.onChanged`, which keeps the popup, the side panel and background captures in sync.
- `popup.js` exposes `CM.app` (`state`, `actions`, `toast`, `allTags`) for `js/panels.js`.

## Development Commands

No build process - vanilla JavaScript.
1. Load unpacked at chrome://extensions/ (Developer mode), or run `npm run dev` (web-ext).
2. Reload the extension after changes.
3. `node --check <file>` is the only automated check; there is no test suite.

## Key Implementation Details

### Storage (chrome.storage.local, schemaVersion 2)
```javascript
clipboardHistory: [{
  id: string,          // crypto.randomUUID(); the only identifier, never use timestamp as a key
  text: string,
  timestamp: number,   // integer ms; bumped when the same text is saved again
  favorite: boolean,
  pinned: boolean,
  tags: string[],
  type: 'url' | 'email' | 'phone' | 'color' | 'code' | 'text',  // always derived from text
  title?: string       // optional snippet name
}],
settings: { theme, autoCapture, maxItems, autoDeleteDays, relativeTime },
schemaVersion: 2
```
- Tags are derived from items; there is no global tag list. Tag colours come from `CM.tagHue(name)`.
- Pinned items and favorites are exempt from `maxItems`, auto-delete and Clear history.
- v1 data (no ids, float timestamps, `tags`/`tagColors` keys) is migrated in `CM.Store.read()`.

### Rendering rules
- User text is only ever inserted as text nodes. `innerHTML` is reserved for the static icon strings in `js/icons.js`.
- No network requests of any kind (no web fonts, no favicon services); `privacy_policy.html` promises this.
- Colours are semantic tokens defined once in `tokens.css` with `light-dark()`. Don't add raw hex values to components. `<html data-theme>` pins light or dark; absent means follow the system.
- Animate only `transform` and `opacity`, using the `--dur-*` / `--ease-*` tokens. List reordering is animated by the FLIP helper in `popup.js` (`withListAnimation`).

### Keyboard (in popup)
- Typing: search. Up/Down: move selection. Enter: copy. Shift+Enter: details. Ctrl/Cmd+Backspace: delete (with undo). Esc: back / clear search / close.
- The key handler ignores events from other text fields, so editing never triggers list actions.

### Destructive actions
- Deletes are immediate with an Undo toast. Only Clear history, retention changes that would remove items, and discarding unsaved edits use the confirm dialog (`CM.confirm`).

### Keeping the docs honest
- Any change to what the extension reads, stores or requests (permissions, capture behaviour, retention defaults) must be reflected in `privacy_policy.html` (including its "What changed" section and dates), `documentation.html`, and the permission justifications in `CHROME_STORE_UPDATE_GUIDE.md`.
