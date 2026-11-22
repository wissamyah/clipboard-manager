# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome extension (Manifest V3) that manages clipboard history with features for saving, searching, filtering, and exporting clipboard items.

## Architecture

### Files
- `manifest.json`: MV3 config. Permissions: clipboardRead, clipboardWrite, storage, contextMenus, activeTab, scripting, sidePanel, offscreen, alarms. No host permissions. Defines the `_execute_action` shortcut (Alt+Shift+V) and the side panel (`popup.html?panel=1`).
- `js/core.js`: Shared, DOM-free core loaded by both the popup and the service worker (`importScripts`). Exposes the global `CM`: `CM.Store` (all storage access), `CM.detectType`, `CM.normalizeItem`, `CM.enforceLimits`, `CM.looksSensitive`, `CM.captureActive`, `CM.pasteIntoTab`, schema migration.
- `background.js`: Service worker. Runs the data migration on install/update, owns the context menus ("Save selection" and the "Paste from Clipboard Manager" submenu, `rebuildMenus`), keeps the capture watcher open exactly while capture is on and not paused (`syncCapture`), and stores what it reports.
- `offscreen.html` / `js/offscreen.js`: The capture watcher, an offscreen document (reason `CLIPBOARD`). Polls the system clipboard once a second and sends new text to the service worker. Exists only while `autoCapture` is on and not paused.
- `popup.html` / `popup.js`: The main list UI (search, filter chips, keyed row rendering, keyboard handling, bulk mode, toasts). One page for three surfaces: the popup, the side panel (`?panel=1`) and the floating window (`?window=1`, a `chrome.windows` popup-type window, single instance). `js/theme-init.js` tags `<html>` with `in-sidepanel` / `in-window`.
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

### Automatic capture
- The clipboard has no change event and a service worker cannot read it, so capture is a poll in the offscreen document: `execCommand('paste')` into a textarea (`navigator.clipboard.readText()` needs focus, which an offscreen document never has). This is the only mechanism that sees copies made outside web pages; do not reintroduce content-script capture.
- An offscreen document can only use `chrome.runtime`, so the watcher messages the service worker (`cm:clipboard`), which applies `CM.looksSensitive` (card numbers, private keys, access tokens in known formats; whole-text matches only; off when `skipSensitive` is false) and writes through `CM.Store`. The watcher re-offers a text until the worker acknowledges it.
- The first read after the watcher starts is a baseline and is never saved. `copyText` in `popup.js` sends `cm:clipboard-written` so copying a saved item is not captured as a new copy.
- `syncCapture()` is idempotent and runs on install/update, browser startup, any settings change, a one-minute watchdog alarm, the resume alarm, and when the UI opens (`cm:sync-capture`).
- Pausing sets `settings.pauseUntil` (a timestamp). The watcher is closed for the duration, so the clipboard is not read and the first read afterwards is a baseline; a one-off alarm reopens it. Turning the setting off or on clears the pause.
- Capture cannot tell where a copy came from, so it cannot skip password fields. The settings text, `privacy_policy.html` and `documentation.html` say so; keep them saying so.

### Pasting into the page
- `CM.pasteIntoTab(tabId, text, frameId?)` injects `pageInsert` (in `js/core.js`, self-contained because it is serialized into the page) with `chrome.scripting`. It only looks at the focused element and inserts text there; it never reads page content. Keep it that way: `privacy_policy.html` says so.
- Access comes from `activeTab` alone, so it works where the user invoked the extension: the popup (toolbar icon or shortcut) and the context menu. In the side panel and the floating window it works only on a tab that already has the grant. Every failure falls back to copying, with a toast that says so. Do not add host permissions to make it more reliable.
- The context menu lists pinned items first, then the most recent (10 in total). `rebuildMenus()` runs on install, startup and whenever a history change alters that list.

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
settings: { theme, autoCapture, maxItems, autoDeleteDays, relativeTime, skipSensitive, pauseUntil },
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
- Typing: search. Ctrl/Cmd+K: focus search. Up/Down: move selection. Enter: copy. Ctrl/Cmd+Enter: paste into the page. Ctrl/Cmd+1…9: copy the row in that position (matched on `event.code`; the numbers show while the modifier is held). Shift+Enter: details. Ctrl/Cmd+Backspace: delete (with undo). Esc: back / clear search / close.
- The key handler ignores events from other text fields, so editing never triggers list actions.

### Destructive actions
- Deletes are immediate with an Undo toast. Only Clear history, retention changes that would remove items, and discarding unsaved edits use the confirm dialog (`CM.confirm`).

### Keeping the docs honest
- Any change to what the extension reads, stores or requests (permissions, capture behaviour, retention defaults) must be reflected in `privacy_policy.html` (including its "What changed" section and dates), `documentation.html`, and the permission justifications in `CHROME_STORE_UPDATE_GUIDE.md`.
