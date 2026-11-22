/**
 * Shared core for Clipboard Manager.
 * Loaded by the popup / side panel (as a script) and by the service worker
 * (via importScripts), so nothing in here may touch the DOM.
 */
'use strict';

const CM = (globalThis.CM = globalThis.CM || {});

CM.SCHEMA_VERSION = 2;
CM.KEYS = {
  HISTORY: 'clipboardHistory',
  SETTINGS: 'settings',
  SCHEMA: 'schemaVersion'
};
CM.LEGACY_KEYS = ['tags', 'tagColors', 'categories'];
CM.MAX_TEXT_LENGTH = 100000;
CM.MAX_ITEMS_OPTIONS = [100, 500, 1000, 5000];
CM.AUTO_DELETE_OPTIONS = [0, 7, 30, 90];

CM.DEFAULT_SETTINGS = {
  theme: 'system', // system | light | dark
  autoCapture: false,
  maxItems: 1000,
  autoDeleteDays: 0, // 0 = never
  relativeTime: true,
  skipSensitive: true, // automatic capture skips card numbers and secret keys
  pauseUntil: 0 // ms timestamp; automatic capture is paused until then
};

/** Whether automatic capture should be running right now. */
CM.captureActive = (settings, now = Date.now()) => settings.autoCapture && now >= settings.pauseUntil;

CM.uid = () => crypto.randomUUID();

/* ---------- Content helpers ---------- */

const URL_RE = /^(https?:\/\/|www\.)\S+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|hsl)a?\([^()]{5,40}\))$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,22}$/;
const DATE_RE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/;
const CODE_KEYWORD_RE = /^\s*(function\b|const\s|let\s|var\s|class\s|import\s|export\s|def\s|return\b|if\s*\(|for\s*\(|while\s*\(|#include\b|public\s|private\s|package\s|using\s|SELECT\s|INSERT\s|UPDATE\s|CREATE\s)/m;

/**
 * Classify a piece of text.
 * @param {string} text
 * @returns {'url'|'email'|'color'|'phone'|'code'|'text'}
 */
CM.detectType = (text) => {
  const t = String(text).trim();
  if (!t) return 'text';

  if (URL_RE.test(t)) return 'url';
  if (EMAIL_RE.test(t)) return 'email';
  if (COLOR_RE.test(t)) return 'color';
  if (PHONE_RE.test(t) && !DATE_RE.test(t)) {
    const digits = t.replace(/\D/g, '').length;
    if (digits >= 7 && digits <= 15) return 'phone';
  }

  // JSON documents
  if (/^[{[]/.test(t) && /[}\]]$/.test(t)) {
    try {
      JSON.parse(t);
      return 'code';
    } catch {
      /* not JSON, keep scoring */
    }
  }

  // Code needs more than one signal: a stray bracket or semicolon is just prose.
  let score = 0;
  if (CODE_KEYWORD_RE.test(t)) score += 2;
  if (/=>/.test(t)) score += 2;
  if (/<\/?[a-z][\w-]*(\s[^<>]*)?\/?>/i.test(t)) score += 2;
  if (/[\w\])]\([^()\n]*\)\s*[;{]/.test(t)) score += 2;
  if (/^\s*(\/\/|\/\*|#!)/m.test(t)) score += 1;
  const lineEndings = t.match(/[;{}]\s*$/gm);
  if (lineEndings) score += Math.min(lineEndings.length, 3);
  if (/^\s*[$#>]\s+\w+/.test(t) && !/\n/.test(t)) score += 1;

  return score >= 2 ? 'code' : 'text';
};

/**
 * Turn a saved link into something safe to open. Returns null for anything
 * that is not plain http(s).
 * @param {string} text
 * @returns {string|null}
 */
CM.normalizeUrl = (text) => {
  let t = String(text).trim();
  if (/^www\./i.test(t)) t = 'https://' + t;
  try {
    const url = new URL(t);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

// Secrets with a recognizable shape. Each must match the whole (trimmed) text,
// so prose or code that merely mentions a token is still saved.
const SECRET_TOKEN_RES = [
  /^eyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]*$/, // JSON Web Token
  /^A[KS]IA[0-9A-Z]{16}$/, // AWS access key id
  /^gh[pousr]_[A-Za-z0-9]{36,}$/, // GitHub token
  /^github_pat_\w{40,}$/,
  /^glpat-[\w-]{20,}$/, // GitLab token
  /^xox[abeoprs]-[\w-]{10,}$/, // Slack token
  /^[sr]k_(?:live|test)_[A-Za-z0-9]{16,}$/, // Stripe key
  /^sk-[\w-]{20,}$/, // OpenAI / Anthropic style key
  /^AIza[\w-]{35}$/, // Google API key
  /^npm_[A-Za-z0-9]{36}$/
];
const PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/;

function looksLikeCardNumber(t) {
  if (!/^[\d\s-]{13,23}$/.test(t)) return false;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  // Luhn check
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Heuristic used by automatic capture to skip payment card numbers, private
 * keys and access tokens. Passwords have no shape and cannot be recognized.
 * @param {string} text
 * @returns {boolean}
 */
CM.looksSensitive = (text) => {
  const t = String(text).trim();
  return looksLikeCardNumber(t) || PRIVATE_KEY_RE.test(t) || SECRET_TOKEN_RES.some((re) => re.test(t));
};

/** Strip surrounding blank lines and trailing whitespace, keep indentation. */
CM.cleanText = (text) => String(text).replace(/^(?:[ \t]*\r?\n)+/, '').replace(/\s+$/, '');

CM.cleanTag = (tag) => String(tag).replace(/[\s,]+/g, ' ').trim().slice(0, 32);

CM.cleanTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const out = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = CM.cleanTag(raw);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 20);
};

/** Stable hue (0-359) for a tag name, so tag colours need no storage. */
CM.tagHue = (tag) => {
  // FNV-1a: short, similar names still land on well-separated hues
  let hash = 2166136261;
  for (let i = 0; i < tag.length; i++) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
};

/**
 * Coerce anything (legacy item, imported row) into a valid item, or null.
 * The type is always re-detected so stored/imported values can't inject one.
 * @param {any} raw
 * @param {{keepId?: boolean}} [opts]
 */
CM.normalizeItem = (raw, opts = {}) => {
  if (!raw || typeof raw.text !== 'string') return null;
  const text = CM.cleanText(raw.text).slice(0, CM.MAX_TEXT_LENGTH);
  if (!text) return null;

  const ts = Number(raw.timestamp);
  const item = {
    id: opts.keepId && typeof raw.id === 'string' && raw.id ? raw.id : CM.uid(),
    text,
    timestamp: Number.isFinite(ts) && ts > 0 ? Math.round(ts) : Date.now(),
    favorite: raw.favorite === true,
    pinned: raw.pinned === true,
    tags: CM.cleanTags(raw.tags),
    type: CM.detectType(text)
  };
  if (typeof raw.title === 'string' && raw.title.trim()) {
    item.title = raw.title.trim().slice(0, 80);
  }
  return item;
};

CM.normalizeSettings = (raw) => {
  const s = { ...CM.DEFAULT_SETTINGS, ...(raw || {}) };
  return {
    theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
    autoCapture: s.autoCapture === true,
    maxItems: CM.MAX_ITEMS_OPTIONS.includes(Number(s.maxItems)) ? Number(s.maxItems) : 1000,
    autoDeleteDays: CM.AUTO_DELETE_OPTIONS.includes(Number(s.autoDeleteDays)) ? Number(s.autoDeleteDays) : 0,
    relativeTime: s.relativeTime !== false,
    skipSensitive: s.skipSensitive !== false,
    pauseUntil: Number.isFinite(Number(s.pauseUntil)) && Number(s.pauseUntil) > 0 ? Math.round(Number(s.pauseUntil)) : 0
  };
};

/**
 * Apply the retention settings. Pinned items and favorites are never removed.
 * @param {Array} items
 * @param {Object} settings
 * @returns {Array} the same array if nothing changed
 */
CM.enforceLimits = (items, settings) => {
  let out = items;
  const isProtected = (i) => i.pinned || i.favorite;

  if (settings.autoDeleteDays > 0) {
    const cutoff = Date.now() - settings.autoDeleteDays * 86400000;
    const kept = out.filter((i) => isProtected(i) || i.timestamp >= cutoff);
    if (kept.length !== out.length) out = kept;
  }

  if (out.length > settings.maxItems) {
    const others = out.filter((i) => !isProtected(i)).sort((a, b) => b.timestamp - a.timestamp);
    const room = Math.max(0, settings.maxItems - (out.length - others.length));
    const keep = new Set(others.slice(0, room).map((i) => i.id));
    out = out.filter((i) => isProtected(i) || keep.has(i.id));
  }
  return out;
};

CM.formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/* ---------- Pasting into a page ---------- */

/**
 * Runs inside the page (chrome.scripting), so it must not use anything from
 * this file. Inserts `text` at the caret of the focused field, or with
 * `probe` only reports what is focused.
 * @returns {'ok'|'editable'|'frame'|'none'}
 */
function pageInsert(text, probe) {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  if (!el) return 'none';
  if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') return 'frame';

  const isField =
    el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|url|tel|email|password)$/.test(el.type));
  if (isField ? el.disabled || el.readOnly : !el.isContentEditable) return 'none';
  if (probe) return 'editable';

  const event = () => new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text });

  if (isField) {
    // insertText keeps the page's undo history; it can refuse when the page
    // is not the focused window, so fall back to editing the value.
    const before = el.value;
    let done = false;
    try {
      done = document.execCommand('insertText', false, text) && el.value !== before;
    } catch {
      done = false;
    }
    if (!done) {
      try {
        el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
      } catch {
        // Email fields have no selection API. Use the prototype setter so
        // frameworks that wrap `value` still see the change.
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, before + text);
      }
      el.dispatchEvent(event());
    }
    return 'ok';
  }

  let done = false;
  try {
    done = document.execCommand('insertText', false, text);
  } catch {
    done = false;
  }
  if (!done) {
    const selection = getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !el.contains(range.commonAncestorContainer)) return 'none';
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    el.dispatchEvent(event());
  }
  return 'ok';
}

/**
 * Insert text into the field that has focus in a tab. Needs access to the
 * tab, which activeTab grants when the user opens the popup or uses the
 * context menu there.
 * @param {number} tabId
 * @param {string} text
 * @param {number} [frameId] the frame to paste into, when it is known
 * @returns {Promise<'ok'|'none'|'blocked'>} 'none': no editable field has
 *   focus; 'blocked': the page cannot be reached
 */
CM.pasteIntoTab = async (tabId, text, frameId) => {
  const run = async (target, probe) =>
    (await chrome.scripting.executeScript({ target, func: pageInsert, args: [text, probe] })).map((r) => ({
      frameId: r.frameId,
      state: r.result
    }));

  try {
    if (frameId == null) {
      // Find the frame holding the focused field without touching anything.
      let frames;
      try {
        frames = await run({ tabId, allFrames: true }, true);
      } catch {
        frames = await run({ tabId }, true);
      }
      const top = frames.find((f) => f.frameId === 0);
      if (top?.state === 'editable') {
        frameId = 0;
      } else {
        // Every frame remembers its own focused element, so with several
        // candidates there is no telling which one the user means.
        const candidates = frames.filter((f) => f.frameId !== 0 && f.state === 'editable');
        if (top?.state !== 'frame' || candidates.length !== 1) return 'none';
        frameId = candidates[0].frameId;
      }
    }
    const [result] = await run({ tabId, frameIds: [frameId] }, false);
    return result?.state === 'ok' ? 'ok' : 'none';
  } catch {
    return 'blocked';
  }
};

/* ---------- Storage ---------- */

// Every write goes through one queue per context so read-modify-write
// sequences never interleave.
let queue = Promise.resolve();
const enqueue = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

async function migrate(data) {
  const seen = new Set();
  const items = [];
  for (const raw of Array.isArray(data[CM.KEYS.HISTORY]) ? data[CM.KEYS.HISTORY] : []) {
    const item = CM.normalizeItem(raw, { keepId: true });
    if (!item) continue;
    if (seen.has(item.id)) item.id = CM.uid();
    seen.add(item.id);
    items.push(item);
  }

  const old = data[CM.KEYS.SETTINGS] || {};
  const settings = CM.normalizeSettings({
    maxItems: old.maxItems,
    autoDeleteDays: old.autoDelete ? old.autoDeleteDays : 0,
    relativeTime: old.showRelativeTime !== false && old.relativeTime !== false,
    autoCapture: old.autoCapture === true,
    // v1 stored theme: 'light' but never used it; start from the system theme.
    theme: data[CM.KEYS.SCHEMA] ? old.theme : 'system'
  });

  await chrome.storage.local.set({
    [CM.KEYS.HISTORY]: items,
    [CM.KEYS.SETTINGS]: settings,
    [CM.KEYS.SCHEMA]: CM.SCHEMA_VERSION
  });
  await chrome.storage.local.remove(CM.LEGACY_KEYS);
  return { items, settings };
}

CM.Store = {
  /**
   * Read history and settings, migrating older data on first use.
   * @returns {Promise<{items: Array, settings: Object}>}
   */
  async read() {
    const data = await chrome.storage.local.get([CM.KEYS.HISTORY, CM.KEYS.SETTINGS, CM.KEYS.SCHEMA]);
    if (data[CM.KEYS.SCHEMA] !== CM.SCHEMA_VERSION) return migrate(data);
    return {
      items: Array.isArray(data[CM.KEYS.HISTORY]) ? data[CM.KEYS.HISTORY] : [],
      settings: CM.normalizeSettings(data[CM.KEYS.SETTINGS])
    };
  },

  /**
   * Read-modify-write the history with a single storage write.
   * @param {(items: Array, settings: Object) => Array|void} fn return the new
   *   array to save, or nothing to leave storage untouched
   * @returns {Promise<Array>} the resulting items
   */
  mutate(fn) {
    return enqueue(async () => {
      const { items, settings } = await CM.Store.read();
      const next = fn(items, settings);
      if (!Array.isArray(next)) return items;
      await chrome.storage.local.set({ [CM.KEYS.HISTORY]: next });
      return next;
    });
  },

  /**
   * Save a piece of text. An identical existing item is moved to the top
   * instead of being duplicated.
   * @param {string} rawText
   * @param {Object} [extra] optional title / tags / pinned / favorite
   * @returns {Promise<{item?: Object, duplicate?: boolean, error?: string}>}
   */
  async addText(rawText, extra = {}) {
    const text = CM.cleanText(rawText);
    if (!text) return { error: 'empty' };
    if (text.length > CM.MAX_TEXT_LENGTH) return { error: 'too-long' };

    let result = {};
    await CM.Store.mutate((items, settings) => {
      const existing = items.find((i) => i.text === text);
      if (existing) {
        existing.timestamp = Date.now();
        result = { item: existing, duplicate: true };
        return items;
      }
      const item = CM.normalizeItem({ ...extra, text, timestamp: Date.now() });
      result = { item, duplicate: false };
      return CM.enforceLimits([item, ...items], settings);
    });
    return result;
  },

  /**
   * Merge a settings patch. Retention changes are applied immediately.
   * @param {Object} patch
   * @returns {Promise<Object>} the new settings
   */
  setSettings(patch) {
    return enqueue(async () => {
      const { items, settings } = await CM.Store.read();
      const next = CM.normalizeSettings({ ...settings, ...patch });
      const out = { [CM.KEYS.SETTINGS]: next };
      if ('maxItems' in patch || 'autoDeleteDays' in patch) {
        const trimmed = CM.enforceLimits(items, next);
        if (trimmed !== items) out[CM.KEYS.HISTORY] = trimmed;
      }
      await chrome.storage.local.set(out);
      return next;
    });
  }
};
