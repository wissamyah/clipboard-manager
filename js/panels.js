/**
 * Slide-over panels (item detail, settings), the confirmation dialog,
 * theming and import/export. Talks to the main list through CM.app, which
 * popup.js defines before any of this runs.
 */
'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Theme ---------- */

  CM.applyTheme = (theme, animate = false) => {
    const root = document.documentElement;
    const current = root.dataset.theme || 'system';
    if (current === theme) return;

    const apply = () => {
      if (theme === 'system') delete root.dataset.theme;
      else root.dataset.theme = theme;
      try {
        localStorage.setItem('cm-theme', theme);
      } catch {
        /* the theme still applies for this session */
      }
    };
    if (animate && document.startViewTransition && !reducedMotion.matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  };

  /* ---------- Confirmation dialog ---------- */

  CM.confirm = ({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger = false }) =>
    new Promise((resolve) => {
      const dialog = $('#confirm');
      $('#confirm-title').textContent = title;
      $('#confirm-body').textContent = body;
      $('#confirm-cancel').textContent = cancel;
      const ok = $('#confirm-ok');
      ok.textContent = confirm;
      ok.className = danger ? 'btn btn-danger solid' : 'btn btn-primary';
      dialog.returnValue = '';
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
      dialog.showModal();
    });

  /* ---------- Panel plumbing ---------- */

  function openPanel(panel) {
    panel.inert = false;
    panel.classList.add('open');
    $('#view').inert = true;
    $('#app').classList.add('has-panel');
  }

  function closePanel(panel) {
    panel.classList.remove('open');
    panel.inert = true;
    $('#view').inert = false;
    $('#app').classList.remove('has-panel');
    $('#search').focus();
  }

  /** Close whichever panel is open. Returns true if there was one. */
  CM.closeTopPanel = () => {
    if (CM.Detail.isOpen()) {
      CM.Detail.requestClose();
      return true;
    }
    if (CM.Settings.isOpen()) {
      CM.Settings.close();
      return true;
    }
    return false;
  };

  /* ---------- Detail / edit panel ---------- */

  const D = { id: null, isNew: false, tags: [], base: { title: '', text: '' } };
  const d = {};

  const currentItem = () => (D.id ? CM.app.state.items.find((i) => i.id === D.id) : null);
  const isDirty = () => d.name.value.trim() !== D.base.title || d.text.value !== D.base.text;

  function paintDetail() {
    const item = currentItem();
    const text = d.text.value;
    const type = CM.detectType(text);

    d.heading.textContent = D.isNew ? 'New snippet' : 'Details';
    for (const el of [d.pin, d.fav, d.del]) el.hidden = D.isNew;
    if (item) {
      d.pin.innerHTML = CM.icon('pin', 16, item.pinned);
      d.pin.classList.toggle('on-pin', item.pinned);
      d.pin.setAttribute('aria-pressed', item.pinned);
      d.pin.title = item.pinned ? 'Unpin' : 'Pin to top';
      d.fav.innerHTML = CM.icon('star', 16, item.favorite);
      d.fav.classList.toggle('on-fav', item.favorite);
      d.fav.setAttribute('aria-pressed', item.favorite);
      d.fav.title = item.favorite ? 'Remove from favorites' : 'Add to favorites';
    }

    d.text.classList.toggle('mono', type === 'code');
    d.open.hidden = !(type === 'url' && CM.normalizeUrl(text));

    // Meta line
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;
    const parts = [
      TYPE_LABELS[type],
      `${text.length.toLocaleString()} ${text.length === 1 ? 'character' : 'characters'}`,
      `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`,
      `${lines.toLocaleString()} ${lines === 1 ? 'line' : 'lines'}`
    ];
    if (item) parts.push(`Saved ${new Date(item.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`);
    d.meta.replaceChildren(...parts.map((p) => Object.assign(document.createElement('span'), { textContent: p })));

    // Tags
    d.tags.replaceChildren(
      ...D.tags.map((tag) => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.style.setProperty('--h', CM.tagHue(tag));
        chip.append(tag);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'tag-remove';
        remove.dataset.tag = tag;
        remove.setAttribute('aria-label', `Remove tag ${tag}`);
        remove.innerHTML = CM.icon('x', 10);
        chip.append(remove);
        return chip;
      })
    );
    d.tagOptions.replaceChildren(
      ...CM.app
        .allTags()
        .filter((tag) => !D.tags.includes(tag))
        .map((tag) => Object.assign(document.createElement('option'), { value: tag }))
    );

    d.save.textContent = D.isNew ? 'Save snippet' : 'Save changes';
    d.save.disabled = !text.trim() || !isDirty();
    d.copy.disabled = !text;
  }

  const TYPE_LABELS = { url: 'Link', email: 'Email', phone: 'Phone', code: 'Code', color: 'Color', text: 'Text' };

  async function saveDetail() {
    const text = d.text.value;
    const title = d.name.value.trim();
    if (!text.trim() || !isDirty()) return;

    if (D.isNew) {
      const result = await CM.app.actions.create({ text, title, tags: D.tags, pinned: true });
      if (result.error) return;
      D.base = { title, text }; // nothing left to discard
      closePanel(d.panel);
      CM.app.toast(result.duplicate ? 'Already saved — moved to the top' : 'Snippet saved and pinned');
      return;
    }
    await CM.app.actions.update(D.id, { text, title });
    D.base = { title, text };
    paintDetail();
    CM.app.toast('Changes saved');
  }

  function setTags(tags) {
    D.tags = tags;
    if (!D.isNew) CM.app.actions.update(D.id, { tags });
    paintDetail();
  }

  function addTagFromInput() {
    const tag = CM.cleanTag(d.tagInput.value);
    d.tagInput.value = '';
    if (!tag || D.tags.includes(tag)) return;
    setTags([...D.tags, tag]);
  }

  CM.Detail = {
    isOpen: () => d.panel.classList.contains('open'),

    /** @param {Object|null} item existing item, or null for a new snippet */
    open(item) {
      D.id = item ? item.id : null;
      D.isNew = !item;
      D.tags = item ? [...item.tags] : [];
      D.base = { title: item?.title || '', text: item?.text || '' };
      d.name.value = D.base.title;
      d.text.value = D.base.text;
      d.tagInput.value = '';
      paintDetail();
      openPanel(d.panel);
      d.text.scrollTop = 0;
      (D.isNew ? d.text : d.back).focus({ preventScroll: true });
    },

    async requestClose() {
      if (isDirty() && d.text.value.trim()) {
        const discard = await CM.confirm({
          title: 'Discard changes?',
          body: 'Your edits to this item have not been saved.',
          confirm: 'Discard',
          cancel: 'Keep editing',
          danger: true
        });
        if (!discard) return;
      }
      closePanel(d.panel);
    },

    /** Called whenever the stored items change. */
    sync() {
      if (!CM.Detail.isOpen() || D.isNew) return;
      const item = currentItem();
      if (!item) {
        closePanel(d.panel);
        return;
      }
      D.tags = [...item.tags];
      paintDetail();
    },

    init() {
      Object.assign(d, {
        panel: $('#detail'),
        heading: $('#d-heading'),
        back: $('#d-back'),
        pin: $('#d-pin'),
        fav: $('#d-fav'),
        del: $('#d-delete'),
        name: $('#d-name'),
        text: $('#d-text'),
        meta: $('#d-meta'),
        tags: $('#d-tags'),
        tagInput: $('#d-tag-input'),
        tagOptions: $('#d-tag-options'),
        open: $('#d-open'),
        save: $('#d-save'),
        copy: $('#d-copy')
      });

      d.back.addEventListener('click', () => CM.Detail.requestClose());
      d.name.addEventListener('input', paintDetail);
      d.text.addEventListener('input', paintDetail);
      d.save.addEventListener('click', saveDetail);
      d.copy.addEventListener('click', async () => {
        const ok = await CM.app.actions.copyText(d.text.value);
        CM.app.toast(ok ? 'Copied to clipboard' : 'Could not copy');
      });
      d.open.addEventListener('click', () => {
        const url = CM.normalizeUrl(d.text.value);
        if (url) chrome.tabs.create({ url });
      });
      d.pin.addEventListener('click', () => {
        const item = currentItem();
        if (item) CM.app.actions.setFlag([item.id], 'pinned', !item.pinned);
      });
      d.fav.addEventListener('click', () => {
        const item = currentItem();
        if (item) CM.app.actions.setFlag([item.id], 'favorite', !item.favorite);
      });
      d.del.addEventListener('click', () => {
        if (!D.id) return;
        const id = D.id;
        closePanel(d.panel);
        CM.app.actions.remove([id]);
      });
      d.tags.addEventListener('click', (event) => {
        const button = event.target.closest('.tag-remove');
        if (button) setTags(D.tags.filter((tag) => tag !== button.dataset.tag));
      });
      d.tagInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          addTagFromInput();
        } else if (event.key === 'Backspace' && !d.tagInput.value && D.tags.length) {
          setTags(D.tags.slice(0, -1));
        }
      });
      // Picking a datalist suggestion fires `change` without a key press
      d.tagInput.addEventListener('change', addTagFromInput);
      d.panel.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && (event.key === 'Enter' || event.key.toLowerCase() === 's')) {
          event.preventDefault();
          saveDetail();
        }
      });
    }
  };

  /* ---------- Settings panel ---------- */

  const s = {};

  function paintOverview() {
    const { items } = CM.app.state;

    const stats = [
      ['Items', items.length],
      ['Pinned', items.filter((i) => i.pinned).length],
      ['Favorites', items.filter((i) => i.favorite).length],
      ['Tags', CM.app.allTags().length]
    ];
    s.stats.replaceChildren(
      ...stats.map(([label, value]) => {
        const cell = document.createElement('div');
        cell.append(
          Object.assign(document.createElement('div'), { className: 'stat-value', textContent: value.toLocaleString() }),
          Object.assign(document.createElement('div'), { className: 'stat-label', textContent: label })
        );
        return cell;
      })
    );

    // Items saved per day, last 7 days
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    const counts = new Array(7).fill(0);
    for (const item of items) {
      const day = Math.floor((item.timestamp - start.getTime()) / 86400000);
      if (day >= 0 && day < 7) counts[day]++;
    }
    const max = Math.max(...counts, 1);
    s.activity.replaceChildren(
      ...counts.map((count, index) => {
        const date = new Date(start);
        date.setDate(date.getDate() + index);
        const col = document.createElement('div');
        col.className = 'spark-col';
        col.title = `${count} saved on ${date.toLocaleDateString([], { weekday: 'long' })}`;
        const bar = document.createElement('div');
        bar.className = count ? 'spark-bar' : 'spark-bar zero';
        bar.style.setProperty('--v', count / max);
        bar.style.setProperty('--i', index);
        col.append(bar, date.toLocaleDateString([], { weekday: 'narrow' }));
        return col;
      })
    );

    chrome.storage.local.getBytesInUse(null).then((bytes) => {
      const quota = chrome.storage.local.QUOTA_BYTES || 10485760;
      const ratio = Math.min(1, bytes / quota);
      s.storageFill.style.width = `${Math.max(ratio * 100, bytes ? 1 : 0)}%`;
      s.storageFill.classList.toggle('warn', ratio >= 0.75 && ratio < 0.9);
      s.storageFill.classList.toggle('full', ratio >= 0.9);
      s.storageText.textContent = `${CM.formatBytes(bytes)} of ${CM.formatBytes(quota)} used`;
    });
  }

  function paintSettings() {
    const { settings } = CM.app.state;
    for (const radio of s.themeRadios) radio.checked = radio.value === settings.theme;
    s.capture.checked = settings.autoCapture;
    s.skipSensitive.checked = settings.skipSensitive;
    s.max.value = String(settings.maxItems);
    s.autoDelete.value = String(settings.autoDeleteDays);
    s.relative.checked = settings.relativeTime;
    paintOverview();
  }

  /** Change a retention setting, asking first if it would remove items. */
  async function changeRetention(patch, select, previous) {
    const { items, settings } = CM.app.state;
    const removed = items.length - CM.enforceLimits(items, { ...settings, ...patch }).length;
    if (removed > 0) {
      const ok = await CM.confirm({
        title: `Remove ${removed.toLocaleString()} ${removed === 1 ? 'item' : 'items'}?`,
        body: 'This setting removes the oldest items that are not pinned or favorited. This cannot be undone.',
        confirm: 'Remove',
        danger: true
      });
      if (!ok) {
        select.value = String(previous);
        return;
      }
    }
    await CM.app.actions.setSettings(patch);
  }

  async function toggleCapture() {
    // The service worker starts or stops the clipboard watcher when the setting changes.
    const autoCapture = s.capture.checked;
    await CM.app.actions.setSettings({ autoCapture, pauseUntil: 0 });
    CM.app.toast(autoCapture ? 'Automatic saving is on' : 'Automatic saving is off');
  }

  CM.Settings = {
    isOpen: () => s.panel.classList.contains('open'),

    open() {
      paintSettings();
      openPanel(s.panel);
      s.panel.querySelector('.panel-body').scrollTop = 0;
      s.back.focus({ preventScroll: true });
    },

    close() {
      closePanel(s.panel);
    },

    sync() {
      if (CM.Settings.isOpen()) paintSettings();
    },

    init() {
      Object.assign(s, {
        panel: $('#settings'),
        back: $('#s-back'),
        themeRadios: [...document.querySelectorAll('input[name="theme"]')],
        capture: $('#s-capture'),
        skipSensitive: $('#s-skip-sensitive'),
        max: $('#s-max'),
        autoDelete: $('#s-autodelete'),
        relative: $('#s-relative'),
        stats: $('#s-stats'),
        activity: $('#s-activity'),
        storageFill: $('#s-storage-fill'),
        storageText: $('#s-storage-text')
      });

      s.back.addEventListener('click', CM.Settings.close);
      for (const radio of s.themeRadios) {
        radio.addEventListener('change', () => {
          CM.applyTheme(radio.value, true);
          CM.app.actions.setSettings({ theme: radio.value });
        });
      }
      s.capture.addEventListener('change', toggleCapture);
      s.skipSensitive.addEventListener('change', () => CM.app.actions.setSettings({ skipSensitive: s.skipSensitive.checked }));
      s.max.addEventListener('change', () =>
        changeRetention({ maxItems: Number(s.max.value) }, s.max, CM.app.state.settings.maxItems)
      );
      s.autoDelete.addEventListener('change', () =>
        changeRetention({ autoDeleteDays: Number(s.autoDelete.value) }, s.autoDelete, CM.app.state.settings.autoDeleteDays)
      );
      s.relative.addEventListener('change', () => CM.app.actions.setSettings({ relativeTime: s.relative.checked }));

      $('#s-import').addEventListener('click', () => CM.Data.pickImportFile());
      $('#s-export-json').addEventListener('click', () => CM.Data.exportItems('json'));
      $('#s-export-txt').addEventListener('click', () => CM.Data.exportItems('txt'));
      $('#s-clear').addEventListener('click', () => CM.app.actions.clearHistory());
      $('#s-shortcut-btn').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

      $('#s-version').textContent = `v${chrome.runtime.getManifest().version}`;
      chrome.commands
        ?.getAll()
        .then((commands) => {
          const open = commands.find((c) => c.name === '_execute_action');
          $('#s-shortcut').textContent = open?.shortcut || 'Not set';
        })
        .catch(() => {});
    }
  };

  /* ---------- Import / export ---------- */

  const TXT_SEPARATOR = '\n\n-----\n\n';

  function download(filename, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Parse an import file into raw items.
   * JSON: an array, or an object with `items` / `clipboardHistory`.
   * Text: blocks separated by a `-----` line (our text export), otherwise
   * one item per non-empty line.
   */
  function parseImport(content) {
    try {
      const data = JSON.parse(content);
      const list = Array.isArray(data) ? data : data?.items || data?.clipboardHistory;
      if (Array.isArray(list)) return list;
    } catch {
      /* not JSON */
    }
    const blocks = /\n-----\n/.test(content) ? content.split(/\n+-----\n+/) : content.split(/\r?\n/);
    const now = Date.now();
    return blocks.map((text, index) => ({ text, timestamp: now - index }));
  }

  CM.Data = {
    exportItems(format) {
      const { items } = CM.app.state;
      if (!items.length) {
        CM.app.toast('Nothing to export yet');
        return;
      }
      const sorted = [...items].sort((a, b) => b.timestamp - a.timestamp);
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        const payload = { app: 'clipboard-manager', version: CM.SCHEMA_VERSION, exportedAt: new Date().toISOString(), items: sorted };
        download(`clipboard-history-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
      } else {
        download(`clipboard-history-${stamp}.txt`, sorted.map((i) => i.text).join(TXT_SEPARATOR) + '\n', 'text/plain;charset=utf-8');
      }
      CM.app.toast(`Exported ${items.length.toLocaleString()} ${items.length === 1 ? 'item' : 'items'}`);
    },

    pickImportFile() {
      const input = $('#import-file');
      input.value = '';
      input.click();
    },

    async importFile(file) {
      try {
        const incoming = parseImport(await file.text())
          .map((raw) => CM.normalizeItem(raw))
          .filter(Boolean);
        if (!incoming.length) {
          CM.app.toast('No items found in that file');
          return;
        }
        let added = 0;
        await CM.Store.mutate((items, settings) => {
          const known = new Set(items.map((i) => i.text));
          const fresh = [];
          for (const item of incoming) {
            if (known.has(item.text)) continue;
            known.add(item.text);
            fresh.push(item);
          }
          added = fresh.length;
          return added ? CM.enforceLimits([...fresh, ...items], settings) : undefined;
        });
        const skipped = incoming.length - added;
        CM.app.toast(
          added
            ? `Imported ${added.toLocaleString()} ${added === 1 ? 'item' : 'items'}${skipped ? ` · ${skipped.toLocaleString()} already saved` : ''}`
            : 'Everything in that file is already saved'
        );
      } catch (error) {
        console.error('Import failed:', error);
        CM.app.toast('Could not read that file');
      }
    },

    init() {
      $('#import-file').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) CM.Data.importFile(file);
      });
    }
  };
})();
