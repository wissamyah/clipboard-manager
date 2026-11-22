/**
 * Service worker: data migration, the context menus ("save selection" and
 * "paste from") and optional automatic capture.
 */
importScripts('js/core.js');

const MENU_ID = 'cm-save-selection';
const PASTE_MENU_ID = 'cm-paste';
const PASTE_ITEM_PREFIX = 'cm-paste:';
const PASTE_MENU_SIZE = 10;
const WATCHER_PATH = 'offscreen.html';
const WATCHER_URL = chrome.runtime.getURL(WATCHER_PATH);
const WATCHDOG_ALARM = 'cm-capture-watchdog';
const RESUME_ALARM = 'cm-capture-resume';

/* ---------- Automatic capture ---------- */

// Capture is a clipboard watcher living in an offscreen document
// (js/offscreen.js). The only job here is to keep that document open exactly
// while the setting is on and not paused, and to store what it reports. The
// watcher is closed during a pause, so the clipboard is not read at all and
// the first read afterwards is a fresh baseline.

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

    // A pause ends on its own: an alarm brings the watcher back.
    if (settings.autoCapture && settings.pauseUntil > Date.now()) {
      await chrome.alarms.create(RESUME_ALARM, { when: settings.pauseUntil });
    } else {
      await chrome.alarms.clear(RESUME_ALARM);
    }

    if (CM.captureActive(settings)) {
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
  if (!CM.captureActive(settings)) return;
  if (settings.skipSensitive && CM.looksSensitive(text)) return;
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
  if (area !== 'local') return;
  if (changes[CM.KEYS.SETTINGS]) syncCapture();

  const history = changes[CM.KEYS.HISTORY];
  if (history && pasteMenuSignature(history.oldValue) !== pasteMenuSignature(history.newValue)) rebuildMenus();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === WATCHDOG_ALARM || alarm.name === RESUME_ALARM) syncCapture();
});

/**
 * Up to 2.1.0 capture was a content script on every site. Drop what it left
 * behind: the registration and the site access it needed.
 */
async function retireContentScriptCapture() {
  await chrome.scripting.unregisterContentScripts({ ids: ['cm-capture'] }).catch(() => {});
  await chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => {});
}

/* ---------- Context menus ---------- */

// "Save selection" on selected text, and on editable fields a "Paste from"
// submenu listing pinned items first, then the most recent ones.

function pasteMenuEntries(items) {
  return (Array.isArray(items) ? [...items] : [])
    .sort((a, b) => b.pinned - a.pinned || b.timestamp - a.timestamp)
    .slice(0, PASTE_MENU_SIZE)
    .map((item) => {
      const label = [...(item.title || item.text).slice(0, 400).replace(/\s+/g, ' ').trim()];
      const short = label.length > 48 ? label.slice(0, 47).join('') + '…' : label.join('');
      // A single "&" would be read as a keyboard accelerator
      return { id: PASTE_ITEM_PREFIX + item.id, title: short.replace(/&/g, '&&') };
    });
}

const pasteMenuSignature = (items) => JSON.stringify(pasteMenuEntries(items));

const createMenu = (properties) =>
  new Promise((resolve) => {
    chrome.contextMenus.create(properties, () => {
      if (chrome.runtime.lastError) console.error('Menu failed:', chrome.runtime.lastError.message);
      resolve();
    });
  });

let menuChain = Promise.resolve();

/** Recreate every menu item from the stored history. */
function rebuildMenus() {
  const run = async () => {
    const { items } = await CM.Store.read();
    await chrome.contextMenus.removeAll();
    await createMenu({ id: MENU_ID, title: 'Save selection to Clipboard Manager', contexts: ['selection'] });

    const entries = pasteMenuEntries(items);
    if (!entries.length) return;
    await createMenu({ id: PASTE_MENU_ID, title: 'Paste from Clipboard Manager', contexts: ['editable'] });
    for (const entry of entries) {
      await createMenu({ ...entry, parentId: PASTE_MENU_ID, contexts: ['editable'] });
    }
  };
  menuChain = menuChain.then(run, run).catch((error) => console.error('Menu rebuild failed:', error));
  return menuChain;
}

function flashBadge(text = '✓') {
  chrome.action.setBadgeBackgroundColor({ color: '#5b5bd6' });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}

async function pasteFromMenu(itemId, info, tab) {
  const { items } = await CM.Store.read();
  const item = items.find((entry) => entry.id === itemId);
  if (!item || tab?.id == null) return;
  const outcome = await CM.pasteIntoTab(tab.id, item.text, info.frameId ?? 0);
  if (outcome !== 'ok') flashBadge('!');
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuItemId = String(info.menuItemId);
  if (menuItemId.startsWith(PASTE_ITEM_PREFIX)) {
    await pasteFromMenu(menuItemId.slice(PASTE_ITEM_PREFIX.length), info, tab);
    return;
  }
  if (menuItemId !== MENU_ID) return;

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
  await CM.Store.read(); // runs the data migration on update
  await rebuildMenus();
  if (reason === 'update') await retireContentScriptCapture();
  await syncCapture();
});

chrome.runtime.onStartup.addListener(() => {
  rebuildMenus();
  syncCapture();
});
