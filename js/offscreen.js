/**
 * Clipboard watcher for automatic capture. Runs in the offscreen document,
 * which the service worker opens only while "Save copies automatically" is on.
 *
 * A service worker has no clipboard, and the system clipboard has no change
 * event, so the only way to notice a copy made anywhere (another app, the
 * address bar, a page's Copy button) is to read the clipboard on a timer and
 * compare. An offscreen document can use nothing but chrome.runtime, so each
 * new text is handed to the service worker, which owns storage.
 */
'use strict';

(() => {
  const POLL_MS = 1000;
  const sink = document.getElementById('sink');

  // The clipboard text as of the last read. null until the first successful
  // read, which only sets the baseline: whatever was on the clipboard before
  // capture started is not ours to save.
  let last = null;

  /**
   * @returns {string|null} the clipboard text ('' when it holds no text), or
   *   null when the read itself failed
   */
  function readClipboard() {
    sink.value = '';
    sink.focus();
    let ok = false;
    try {
      // navigator.clipboard.readText() needs a focused document, which an
      // offscreen document never is; the paste command only needs clipboardRead.
      ok = document.execCommand('paste');
    } catch {
      ok = false;
    }
    const text = sink.value;
    sink.value = '';
    return ok ? text : null;
  }

  function rebaseline() {
    const text = readClipboard();
    if (text !== null) last = text;
  }

  async function poll() {
    const text = readClipboard();
    if (text === null || text === last) return;

    const previous = last;
    last = text;
    if (previous === null || !text.trim()) return;

    try {
      await chrome.runtime.sendMessage({ type: 'cm:clipboard', text });
    } catch {
      // The service worker did not take it; offer it again on the next poll,
      // unless the clipboard has moved on in the meantime.
      if (last === text) last = previous;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) return;
    // The popup copied one of its own items: that is not a new copy.
    if (message?.type === 'cm:clipboard-written') rebaseline();
  });

  rebaseline();
  setInterval(poll, POLL_MS);
})();
