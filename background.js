/**
 * Service worker: data migration, the "save selection" context menu and
 * optional automatic capture.
 */
importScripts('js/core.js');

const MENU_ID = 'cm-save-selection';
const WATCHER_PATH = 'offscreen.html';
const WATCHER_URL = chrome.runtime.getURL(WATCHER_PATH);
const WATCHDOG_ALARM = 'cm-capture-watchdog';

/* ---------- Automatic capture ---------- */

// Capture is a clipboard watcher living in an offscreen document
// (js/offscreen.js). The only job here is to keep that document open exactly
// while the setting is on, and to store what it reports.

async function watcherIsOpen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [WATCHER_URL]
  });
  return contexts.length > 0;
}

let syncChain = Promise.resolve();

/**
 * Make the watcher match the setting. Idempotent, and called from every
 * signal that could have left the two out of step.
 */
function syncCapture() {
  const run = async () => {
    const { settings } = await CM.Store.read();
    const open = await watcherIsOpen();

    if (settings.autoCapture) {
      if (!open) {
        await chrome.offscreen.createDocument({
          url: WATCHER_PATH,
          reasons: ['CLIPBOARD'],
          justification: 'Read the clipboard to save what the user copies to their clipboard history.'
        });
      }
      // Nothing wakes the service worker if the watcher is ever lost, so a
      // slow alarm checks that it is still there.
      if (!(await chrome.alarms.get(WATCHDOG_ALARM))) {
        await chrome.alarms.create(WATCHDOG_ALARM, { periodInMinutes: 1 });
      }
    } else {
      if (open) await chrome.offscreen.closeDocument();
      await chrome.alarms.clear(WATCHDOG_ALARM);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;

  if (message?.type === 'cm:clipboard' && sender.url === WATCHER_URL && typeof message.text === 'string') {
    // The watcher offers the text again unless it hears back.
    handleCapture(message.text)
      .catch((error) => console.error('Capture failed:', error))
      .finally(() => sendResponse(true));
    return true;
  }

  if (message?.type === 'cm:sync-capture') syncCapture();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[CM.KEYS.SETTINGS]) syncCapture();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WATCHDOG_ALARM) syncCapture();
});

/**
 * Up to 2.1.0 capture was a content script on every site. Drop what it left
 * behind: the registration and the site access it needed.
 */
async function retireContentScriptCapture() {
  await chrome.scripting.unregisterContentScripts({ ids: ['cm-capture'] }).catch(() => {});
  await chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
}

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

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Save selection to Clipboard Manager',
      contexts: ['selection']
    });
  });
  await CM.Store.read(); // runs the data migration on update
  if (reason === 'update') await retireContentScriptCapture();
  await syncCapture();
});

chrome.runtime.onStartup.addListener(() => {
  syncCapture();
});
