# Chrome Web Store Update Guide for Clipboard Manager v2.2.0

## Pre-Update Checklist
- [x] Version updated in manifest.json to "2.2.0"
- [x] documentation.html updated for the new interface and features
- [x] privacy_policy.html updated (automatic saving from the system clipboard, offscreen/alarms permissions, site access removed)
- [ ] Load the unpacked extension and test on a real Chrome profile (see "What to test" below)
- [ ] Test the update path: install v1.2.1 with some saved items, then load v2.2.0 over it and confirm the history is migrated
- [ ] Publish the updated privacy_policy.html to its public URL (GitHub Pages) **before** submitting. It now needs `tokens.css`, `pages.css`, `js/theme-init.js` and `icon-48.png` next to it
- [ ] Confirm the "Last updated" / "Effective" dates in privacy_policy.html match the day you publish
- [ ] Create a backup of the current store version

### What to test
- Save, copy, pin, favorite, delete + Undo, edit, tags, new snippet
- Light, dark and system themes
- Turning "Save copies automatically" on and off (no permission prompt). With it on, copy text in another app, in the address bar and on a page: each appears within about a second, also while Chrome is in the background
- Update path for capture: load v2.1.0 with automatic saving on, then load v2.2.0 over it. Capture keeps working and `chrome://extensions` no longer lists site access
- Right-click → "Save selection to Clipboard Manager"
- Alt+Shift+V shortcut, the side panel and floating window buttons next to Save, import and export

## Step 1: Create Extension Package
The folder now contains development files that must **not** be uploaded (`node_modules`, `package.json`, docs).

```bash
# macOS / Linux, run in the extension directory:
zip -r ../clipboard-manager-v2.2.0.zip \
  manifest.json background.js popup.html popup.js offscreen.html \
  styles.css tokens.css pages.css \
  documentation.html privacy_policy.html \
  icon-16.png icon-48.png icon-128.png js
```

```powershell
# Windows PowerShell:
Compress-Archive -Force -DestinationPath ../clipboard-manager-v2.2.0.zip -Path `
  manifest.json, background.js, popup.html, popup.js, offscreen.html, styles.css, tokens.css, pages.css, `
  documentation.html, privacy_policy.html, icon-16.png, icon-48.png, icon-128.png, js
```

## Step 2: Access Developer Dashboard
1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Find "Clipboard Manager" in your extensions list

## Step 3: Upload New Package
1. Click on "Clipboard Manager" extension
2. Navigate to "Package" tab
3. Click "Upload new package"
4. Upload `clipboard-manager-v2.2.0.zip`
5. Wait for validation to complete

## Step 4: Update Store Listing

### Update Description
Replace the v1.2.1 feature text (the statistics dashboard, storage optimization, compression and markdown preview no longer exist):

```
NEW IN 2.2
• Automatic saving now records text you copy anywhere on your computer, not only on web pages (optional, off by default)
• No access to the sites you visit is needed any more
• Floating window, with one-click buttons for it and the side panel

VERSION 2.0 - A COMPLETE REDESIGN

NEW
• New interface: compact list, one search bar, click any item to copy
• Light and dark themes that follow your system
• Automatic saving (optional): record what you copy without pressing Save
• Edit saved text, name it, and build reusable snippets
• Side panel: keep your history open beside the page
• Keyboard shortcut (Alt+Shift+V) and right-click "Save selection"
• Undo for deletes

ORGANIZE
• Search text, names and tags with highlighted matches
• Combine filters: Pinned, Favorites, Links, Code and your tags
• Pins and favorites are never removed automatically
• Select several items to pin, favorite or delete at once

PRIVATE BY DESIGN
• Everything stays on your device
• No accounts, no analytics, no network requests
• Full JSON backup and restore
```

### Update Screenshots (Recommended)
Take new screenshots (1280x800 or 640x400 pixels, PNG). The old ones show the removed dark-green design.
1. Main list, light theme
2. Main list, dark theme
3. Search with highlighted matches and filter chips
4. Item details / editing
5. Settings (theme, automatic saving, overview)

## Step 5: Privacy Practices
Open the "Privacy practices" tab. Several answers change in v2.0.0.

### Single purpose
"Save, organize and reuse text the user copies (a clipboard history)."

### Permission Justifications
- **clipboardRead**: "Reads clipboard text when the user clicks Save. If the user turns on 'Save copies automatically', also reads the clipboard about once a second to add newly copied text to the local history"
- **clipboardWrite**: "Copies a saved item back to the clipboard when the user clicks it"
- **storage**: "Stores the clipboard history and settings locally on the user's device"
- **contextMenus**: "Adds a 'Save selection to Clipboard Manager' item to the right-click menu"
- **activeTab**: "Gives access to the current page only when the user chooses that menu item, to read the selected text with its line breaks"
- **scripting**: "Reads the selected text for the context-menu item"
- **sidePanel**: "Lets the user open their clipboard history in Chrome's side panel"
- **offscreen**: "Service workers cannot read the clipboard. While the user has 'Save copies automatically' turned on, an offscreen document (reason: CLIPBOARD) reads the clipboard text and passes it to the service worker, which stores it in chrome.storage.local. The document is closed when the setting is turned off. Nothing is transmitted"
- **alarms**: "A one-minute alarm, set only while 'Save copies automatically' is on, re-opens the offscreen clipboard document if Chrome has closed it"
- **Host permissions**: none. The optional `<all_urls>` permission from v2.0-2.1 is removed; the update revokes it for users who had granted it

### Remote code
- "No, I am not using remote code"

### Data usage
v1.2.1 declared "This extension does not collect user data". With automatic saving, the extension handles whatever text the user copies, in any app (stored locally, never transmitted); this can include passwords and other personal data. Read the dashboard's definitions carefully before certifying; the cautious choice is to declare **Website content**, **Authentication information** and **Personal communications**, and state in the justification that the data is stored only on the device. The setting's description in the extension is the in-product disclosure; keep it in sync with the policy.
- ✅ "I do not sell or transfer user data to third parties, outside of the approved use cases"
- ✅ "I do not use or transfer user data for purposes that are unrelated to my item's single purpose"
- ✅ "I do not use or transfer user data to determine creditworthiness or for lending purposes"

### Privacy policy URL
Must point to the published v2.2.0 policy.

## Step 6: Distribution Settings
- **Visibility**: Public
- **Geographic distribution**: All regions
- **Pricing**: Free

## Step 7: Submit for Review
1. Click "Submit for review"
2. Review checklist
3. Click "Submit"

## Review Timeline
- v2.2.0 widens what automatic saving reads (the system clipboard) and adds the offscreen and alarms permissions, so expect an in-depth review that can take longer than the usual 1-3 business days
- Email notification upon approval/rejection

## What existing users will see
- The permissions added since v1.2.1 (contextMenus, activeTab, scripting, sidePanel, offscreen, alarms) do not show an install warning, so the update should not disable the extension. Verify this with the update-path test above
- No site access is requested. Users who had automatic saving on in v2.0-2.1 keep it on, now covering copies made anywhere; the site access they granted is removed
- Their history is migrated automatically on first run

## Common Rejection Reasons
1. **Privacy policy mismatch**: The public policy must describe automatic saving and match the data-usage answers
2. **Unclear permissions**: Use the justifications above
3. **Screenshot issues**: Screenshots must show the current interface
4. **Description violations**: Remove promotional language

## Post-Approval
1. Test update from Chrome Web Store
2. Monitor user reviews
3. Track metrics in Analytics tab

## Important Links
- Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Extension Policies: https://developer.chrome.com/docs/webstore/program-policies
- Best Practices: https://developer.chrome.com/docs/webstore/best-practices
- Support: https://support.google.com/chrome_webstore/

## Notes
- ⚠️ Cannot rollback versions once published
- 💡 Consider gradual rollout (5% → 100%)
- 📊 Monitor Analytics for user trends

## Screenshot helper
Paste into the DevTools console of the popup (right-click the popup → Inspect) to centre it on a 1280x800 canvas.

```js
document.documentElement.style.cssText = 'width:1280px;height:800px;margin:0;padding:0;background:#e9ebf0;';
document.body.style.cssText = 'width:1280px;height:800px;margin:0;padding:0;position:relative;background:#e9ebf0;overflow:visible;';
const app = document.getElementById('app');
app.style.cssText = 'width:440px;height:600px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.25);';
```
