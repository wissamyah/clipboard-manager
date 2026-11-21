/**
 * Service worker: data migration, the "save selection" context menu and
 * optional automatic capture.
 */
importScripts('js/core.js');

const CAPTURE_SCRIPT_ID = 'cm-capture';
const MENU_ID = 'cm-save-selection';
const PAGE_MATCHES = ['http://*/*', 'https://*/*'];

async function hasSiteAccess() {
  try {
    return await chrome.permissions.contains(CM.ALL_URLS);
  } catch {
    return false;
  }
}

/* ---------- Automatic capture ---------- */

async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: PAGE_MATCHES });
  await Promise.allSettled(
    tabs.map((tab) =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['js/capture.js']
      })
    )
  );
}

let syncChain = Promise.resolve();

/**
 * Make the registered content script match the setting + permission.
 * @param {{reinject?: boolean}} [options] reinject: also (re)inject into tabs
 *   that are already open, for when their copy of the script has gone stale.
 */
function syncCapture({ reinject = false } = {}) {
  const run = async () => {
    const { settings } = await CM.Store.read();
    const wanted = settings.autoCapture && (await hasSiteAccess());
    const registered = await chrome.scripting
      .getRegisteredContentScripts({ ids: [CAPTURE_SCRIPT_ID] })
      .catch(() => []);

    if (wanted && registered.length === 0) {
      await chrome.scripting.registerContentScripts([
        {
          id: CAPTURE_SCRIPT_ID,
          js: ['js/capture.js'],
          matches: PAGE_MATCHES,
          allFrames: true,
          runAt: 'document_start',
          persistAcrossSessions: true
        }
      ]);
      await injectIntoOpenTabs();
    } else if (wanted && reinject) {
      await injectIntoOpenTabs();
    } else if (!wanted && registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [CAPTURE_SCRIPT_ID] });
    }
  };
  syncChain = syncChain.then(run, run).catch((error) => console.error('Capture sync failed:', error));
  return syncChain;
}

async function handleCapture(text) {
  const { settings } = await CM.Store.read();
  if (!settings.autoCapture || CM.looksSensitive(text)) return;
  await CM.Store.addText(text);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'cm:capture' && typeof message.text === 'string') {
    handleCapture(message.text).catch((error) => console.error('Capture failed:', error));
  }
});

// The permission prompt can close the popup before it hears the answer, so
// the setting follows the permission from here.
chrome.permissions.onAdded.addListener(async () => {
  if (await hasSiteAccess()) await CM.Store.setSettings({ autoCapture: true });
});

chrome.permissions.onRemoved.addListener(async () => {
  if (!(await hasSiteAccess())) await CM.Store.setSettings({ autoCapture: false });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[CM.KEYS.SETTINGS]) syncCapture();
});

/* ---------- Context menu ---------- */

function flashBadge() {
  chrome.action.setBadgeBackgroundColor({ color: '#5b5bd6' });
  chrome.action.setBadgeText({ text: '✓' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  // info.selectionText collapses line breaks, so prefer the real selection.
  let text = info.selectionText || '';
  if (tab?.id != null) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
        func: () => String(getSelection() || '')
      });
      if (result?.result) text = result.result;
    } catch {
      /* page not scriptable: fall back to selectionText */
    }
  }

  const saved = await CM.Store.addText(text);
  if (saved.item) flashBadge();
});

/* ---------- Lifecycle ---------- */

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Save selection to Clipboard Manager',
      contexts: ['selection']
    });
  });
  await CM.Store.read(); // runs the data migration on update
  // An update or reload orphans the capture script in every open tab.
  await syncCapture({ reinject: true });
});

chrome.runtime.onStartup.addListener(() => {
  syncCapture();
});
