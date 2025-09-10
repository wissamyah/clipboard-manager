# Chrome Web Store Update Guide for Clipboard Manager v1.2.1

## Pre-Update Checklist
- [x] Version updated in manifest.json to "1.2.1"
- [x] Documentation.html updated with new features
- [x] Privacy_policy.html updated with current practices
- [ ] Test extension locally one final time
- [ ] Create backup of current version

## Step 1: Create Extension Package
```bash
# Run this command in the extension directory:
Compress-Archive -Path * -DestinationPath ../clipboard-manager-v1.2.1.zip -Force
```

## Step 2: Access Developer Dashboard
1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with your Google account
3. Find "Clipboard Manager" in your extensions list

## Step 3: Upload New Package
1. Click on "Clipboard Manager" extension
2. Navigate to "Package" tab
3. Click "Upload new package"
4. Upload `clipboard-manager-v1.2.1.zip`
5. Wait for validation to complete

## Step 4: Update Store Listing

### Update Description
Add this text to highlight new features:

```
🆕 VERSION 1.2.1 - MAJOR UPDATE!

✨ NEW FEATURES:
• 📊 Statistics Dashboard - Track usage patterns and storage
• 🏷️ Advanced Tag System - Organize with color-coded tags
• 📌 Pin Important Items - Keep frequently used items at the top
• 🎯 Bulk Operations - Select multiple items for batch actions
• 🔍 Smart Filtering - Filter by type, tags, date, and more
• 💾 Storage Optimization - Automatic cleanup and compression
• 📤 Import/Export - Backup and restore your clipboard data

⚡ IMPROVEMENTS:
• Dark mode UI with modern design
• Enhanced search with 300ms debouncing
• Rich text preview with markdown support
• Keyboard navigation support
• Memory usage monitoring
• Automatic duplicate detection
```

### Update Screenshots (Recommended)
Take new screenshots (1280x800 or 640x400 pixels, PNG):
1. Main interface with dark theme
2. Statistics Dashboard
3. Tag management feature
4. Bulk operations
5. Rich text preview

## Step 5: Privacy Practices
1. Go to "Privacy practices" tab
2. Confirm:
   - ✅ "This extension does not collect user data"
   - ✅ "Data is not sold to third parties"
   - ✅ "Data is not used for purposes unrelated to core functionality"

### Permission Justifications
- **clipboardRead**: "Required to read clipboard content when user clicks SAVE button"
- **clipboardWrite**: "Required to copy saved items back to clipboard when clicked"
- **storage**: "Required to store clipboard history locally on user's device"

## Step 6: Distribution Settings
- **Visibility**: Public
- **Geographic distribution**: All regions
- **Pricing**: Free

## Step 7: Submit for Review
1. Click "Submit for review"
2. Review checklist
3. Click "Submit"

## Review Timeline
- Typically 1-3 business days
- Email notification upon approval/rejection

## Common Rejection Reasons
1. **Missing privacy policy**: Host privacy_policy.html on GitHub Pages
2. **Unclear permissions**: Add detailed justifications
3. **Screenshot issues**: Ensure clear functionality demonstration
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



// Force screenshot canvas
document.documentElement.style.cssText = `
  width: 1280px;
  height: 800px;
  margin: 0;
  padding: 0;
  background: #3a3a3a; /* slightly lighter dark grey background */
`;
document.body.style.cssText = `
  width: 1280px;
  height: 800px;
  margin: 0;
  padding: 0;
  position: relative;  /* Changed to relative for absolute positioning child */
  background: #3a3a3a;
`;
// Create wrapper if not already created
let wrapper = document.querySelector('#screenshot-wrapper');
if (!wrapper) {
  wrapper = document.createElement('div');
  wrapper.id = 'screenshot-wrapper';
  wrapper.style.cssText = `
    width: 420px;               /* your popup's real width */
    height: 720px;              /* simulate popup height */
    position: absolute;         /* Use absolute positioning */
    top: 50%;                   /* Position from top */
    left: 50%;                  /* Position from left */
    transform: translate(-50%, -50%); /* Center by moving back 50% of its own size */
    display: flex;
    flex-direction: column;
    background: white;
    box-shadow: 0 0 40px rgba(0,0,0,0.3);
    overflow: hidden;           /* important: prevent infinite growth */
  `;
  // Move all current children into wrapper
  while (document.body.firstChild) {
    wrapper.appendChild(document.body.firstChild);
  }
  document.body.appendChild(wrapper);
}
// Force main content to scroll instead of pushing footer
const main = document.querySelector('main');
if (main) {
  main.style.flex = '1';         // take remaining space
  main.style.overflowY = 'auto'; // make it scrollable
}