/**
 * Content script for automatic capture. Only registered after the user turns
 * on "Save copies automatically" and grants site access. It forwards the text
 * of copy/cut events to the service worker; nothing leaves the device.
 */
(() => {
  // Reloading or updating the extension leaves the previous copy of this
  // script in the page with a dead connection, and the new copy lands in the
  // same isolated world. Replace the old listeners instead of bailing out.
  try {
    globalThis.__cmCaptureTeardown?.();
  } catch {
    /* nothing to clean up */
  }

  const SKIP_AUTOCOMPLETE = /password|cc-|one-time-code/i;

  function selectedText() {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      if (el.type === 'password' || SKIP_AUTOCOMPLETE.test(el.autocomplete || '')) return '';
      try {
        const text = el.value.substring(el.selectionStart, el.selectionEnd);
        if (text) return text;
      } catch {
        /* input type without a text selection */
      }
    }
    return String(document.getSelection() || '');
  }

  function onCopy() {
    try {
      const text = selectedText();
      if (!text.trim() || !chrome.runtime?.id) return;
      chrome.runtime.sendMessage({ type: 'cm:capture', text }).catch(() => {});
    } catch {
      /* extension was reloaded or removed; stay silent on the page */
    }
  }

  document.addEventListener('copy', onCopy, true);
  document.addEventListener('cut', onCopy, true);

  globalThis.__cmCaptureTeardown = () => {
    document.removeEventListener('copy', onCopy, true);
    document.removeEventListener('cut', onCopy, true);
  };
})();
