/**
 * Main list UI for Clipboard Manager (popup and side panel).
 *
 * Data flow: every action writes through CM.Store, and the UI redraws from
 * chrome.storage.onChanged. That single path keeps the popup, the side panel
 * and background captures in sync without any manual refreshing.
 */
'use strict';

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const FILTERS = [
    ['all', 'All'],
    ['pinned', 'Pinned'],
    ['favorites', 'Favorites'],
    ['url', 'Links'],
    ['code', 'Code']
  ];
  const TYPE_ICONS = { url: 'link', email: 'mail', phone: 'phone', code: 'code', text: 'text' };
  const PREVIEW_LENGTH = 320;

  const state = {
    items: [],
    settings: { ...CM.DEFAULT_SETTINGS },
    visible: [],
    query: '',
    terms: [],
    filter: 'all',
    tags: new Set(),
    sort: 'desc',
    activeId: null,
    copiedId: null,
    bulk: false,
    checked: new Set()
  };

  const els = {};
  const rows = new Map(); // item id -> <li>
  const haystacks = new WeakMap(); // item -> lowercased searchable text
  let chipsSignature = null;
  let copiedTimer = 0;

  /**
   * Tiny element builder. `html` is only ever given static icon markup;
   * all user content goes in as text nodes.
   */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'html') el.innerHTML = value;
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child != null && child !== false) el.append(child);
    }
    return el;
  }

  const plural = (count, word) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
  const byId = (id) => state.items.find((item) => item.id === id);

  /* ---------- Derived data ---------- */

  function allTags() {
    const counts = new Map();
    for (const item of state.items) {
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  }

  function haystack(item) {
    let value = haystacks.get(item);
    if (value === undefined) {
      value = `${item.title || ''}\n${item.text}\n${item.tags.join('\n')}`.toLowerCase();
      haystacks.set(item, value);
    }
    return value;
  }

  function getVisible() {
    const { filter, tags, terms } = state;
    const out = state.items.filter((item) => {
      if (filter === 'pinned' && !item.pinned) return false;
      if (filter === 'favorites' && !item.favorite) return false;
      if ((filter === 'url' || filter === 'code') && item.type !== filter) return false;
      for (const tag of tags) if (!item.tags.includes(tag)) return false;
      if (terms.length) {
        const hay = haystack(item);
        for (const term of terms) if (!hay.includes(term)) return false;
      }
      return true;
    });
    const direction = state.sort === 'asc' ? 1 : -1;
    return out.sort((a, b) => b.pinned - a.pinned || direction * (a.timestamp - b.timestamp));
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    if (state.settings.relativeTime) {
      const minutes = Math.floor((now - date) / 60000);
      if (minutes < 1) return 'now';
      if (minutes < 60) return `${minutes}m`;
      if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
      if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
    } else if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const options = { month: 'short', day: 'numeric' };
    if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return date.toLocaleDateString([], options);
  }

  /** One-line preview of an item, starting near the first search match. */
  function preview(item) {
    const text = item.text;
    let start = 0;
    if (state.terms.length) {
      const lower = text.toLowerCase();
      const hits = state.terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
      const first = hits.length ? Math.min(...hits) : 0;
      if (first > PREVIEW_LENGTH - 60) start = first - 40;
    }
    const slice = text.slice(start, start + PREVIEW_LENGTH).replace(/\s+/g, ' ').trim();
    return (start > 0 ? '…' : '') + slice;
  }

  function highlight(text) {
    if (!state.terms.length) return [text];
    const pattern = state.terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return text
      .split(new RegExp(`(${pattern})`, 'gi'))
      .map((part, index) => (index % 2 ? h('mark', null, part) : part))
      .filter((part) => part !== '');
  }

  /* ---------- Rendering ---------- */

  function renderChips() {
    const tags = allTags();
    for (const tag of [...state.tags]) if (!tags.includes(tag)) state.tags.delete(tag);

    const signature = tags.join('\u0001');
    if (signature !== chipsSignature) {
      chipsSignature = signature;
      const chips = FILTERS.map(([value, label]) =>
        h('button', { type: 'button', class: 'chip', dataset: { filter: value } }, label)
      );
      if (tags.length) chips.push(h('span', { class: 'chip-sep', 'aria-hidden': 'true' }));
      for (const tag of tags) {
        chips.push(h('button', { type: 'button', class: 'chip', dataset: { tag }, title: `Tag: ${tag}` }, `#${tag}`));
      }
      els.chips.replaceChildren(...chips);
    }
    for (const chip of els.chips.querySelectorAll('.chip')) {
      const pressed = chip.dataset.filter ? chip.dataset.filter === state.filter : state.tags.has(chip.dataset.tag);
      chip.setAttribute('aria-pressed', pressed);
    }

    const newest = state.sort === 'desc';
    els.sort.innerHTML = CM.icon(newest ? 'sortDesc' : 'sortAsc', 15);
    els.sort.title = newest ? 'Newest first' : 'Oldest first';
    els.sort.setAttribute('aria-label', `Sort order: ${els.sort.title}`);
  }

  function actionButton(action, icon, label, extraClass = '', filled = false) {
    return h('button', {
      type: 'button',
      class: `icon-btn ${extraClass}`,
      tabindex: '-1',
      title: label,
      'aria-label': label,
      dataset: { act: action },
      html: CM.icon(icon, 15, filled)
    });
  }

  function buildRow(el, item) {
    const typeTile = h('span', { class: `row-type t-${item.type}`, 'aria-hidden': 'true' });
    if (item.type === 'color') {
      const swatch = h('span', { class: 'swatch' });
      swatch.style.background = item.text.trim(); // invalid values are ignored by the CSSOM
      typeTile.append(swatch);
    } else {
      typeTile.innerHTML = CM.icon(TYPE_ICONS[item.type] || 'text', 15);
    }

    const body = h(
      'div',
      { class: 'row-body' },
      item.title && h('div', { class: 'row-title' }, highlight(item.title)),
      h('div', { class: `row-text${item.type === 'code' ? ' mono' : ''}` }, highlight(preview(item))),
      item.tags.length > 0 &&
        h(
          'div',
          { class: 'row-tags' },
          item.tags.map((tag) => {
            const chip = h('span', { class: 'tag' }, highlight(tag));
            chip.style.setProperty('--h', CM.tagHue(tag));
            return chip;
          })
        )
    );

    const trail = h(
      'div',
      { class: 'row-trail' },
      h(
        'span',
        { class: 'row-status' },
        item.pinned && h('span', { class: 'is-pin', title: 'Pinned', html: CM.icon('pin', 12, true) }),
        item.favorite && h('span', { class: 'is-fav', title: 'Favorite', html: CM.icon('star', 12, true) }),
        h('time', { title: new Date(item.timestamp).toLocaleString() }, formatTime(item.timestamp))
      ),
      h(
        'span',
        { class: 'row-actions' },
        actionButton('pin', 'pin', item.pinned ? 'Unpin' : 'Pin to top', item.pinned ? 'on-pin' : '', item.pinned),
        actionButton('fav', 'star', item.favorite ? 'Remove from favorites' : 'Add to favorites', item.favorite ? 'on-fav' : '', item.favorite),
        actionButton('open', 'chevron', 'Details and edit'),
        actionButton('del', 'trash', 'Delete', 'danger')
      ),
      h('span', { class: 'row-copied', html: CM.icon('check', 14) }, 'Copied')
    );

    const check = h('span', { class: 'row-check' }, h('input', { type: 'checkbox', tabindex: '-1', 'aria-label': 'Select item' }));
    el.replaceChildren(check, typeTile, body, trail);
  }

  function rowSignature(item) {
    return [
      item.timestamp,
      formatTime(item.timestamp),
      item.pinned,
      item.favorite,
      item.type,
      item.title || '',
      item.tags.join(','),
      state.terms.join(' '),
      item.text.length,
      item.text.slice(0, PREVIEW_LENGTH)
    ].join('\u0001');
  }

  /** Keyed update: reuse existing rows, rebuild only the ones that changed. */
  function patchList(visible, initial) {
    const keep = new Set();
    let cursor = els.list.firstElementChild;

    visible.forEach((item, index) => {
      let el = rows.get(item.id);
      const signature = rowSignature(item);
      if (!el) {
        el = h('li', { class: 'row', role: 'option', id: `row-${item.id}`, dataset: { id: item.id } });
        rows.set(item.id, el);
        if (initial && index < 12) {
          el.classList.add('enter');
          el.style.setProperty('--i', index);
        }
      }
      if (el._signature !== signature) {
        el._signature = signature;
        buildRow(el, item);
      }
      keep.add(item.id);
      if (el === cursor) cursor = cursor.nextElementSibling;
      else els.list.insertBefore(el, cursor);
    });

    for (const [id, el] of rows) {
      if (!keep.has(id)) {
        el.remove();
        rows.delete(id);
      }
    }
  }

  /**
   * FLIP: measure rows, apply the DOM change, then animate each row from its
   * old position to its new one. Only rows near the viewport are touched.
   */
  function withListAnimation(change) {
    if (reducedMotion.matches || document.hidden) {
      change();
      return;
    }
    const limit = els.listWrap.getBoundingClientRect().bottom + 200;
    const before = new Map();
    for (const el of els.list.children) {
      const top = el.getBoundingClientRect().top;
      if (top > limit) break;
      before.set(el, top);
    }

    change();

    for (const el of els.list.children) {
      const top = el.getBoundingClientRect().top;
      if (top > limit) break;
      const previous = before.get(el);
      if (previous === undefined) {
        el.animate(
          [{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }],
          { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      } else if (Math.abs(previous - top) > 1) {
        el.animate(
          [{ transform: `translateY(${previous - top}px)` }, { transform: 'none' }],
          { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      }
    }
  }

  /** Cheap per-row state that never needs a rebuild. */
  function syncRowStates() {
    for (const item of state.visible) {
      const el = rows.get(item.id);
      if (!el) continue;
      const active = item.id === state.activeId;
      const checked = state.bulk && state.checked.has(item.id);
      el.classList.toggle('active', active);
      el.classList.toggle('checked', checked);
      el.classList.toggle('copied', item.id === state.copiedId);
      el.setAttribute('aria-selected', state.bulk ? checked : active);
      el.querySelector('.row-check input').checked = checked;
    }
    if (state.activeId) els.search.setAttribute('aria-activedescendant', `row-${state.activeId}`);
    else els.search.removeAttribute('aria-activedescendant');
  }

  function renderEmpty() {
    if (state.visible.length) {
      els.empty.hidden = true;
      return;
    }
    const filtered = state.items.length > 0;
    const content = filtered
      ? [
          h('div', { class: 'empty-icon', html: CM.icon('search', 22) }),
          h('div', { class: 'empty-title' }, 'No matches'),
          h('div', { class: 'empty-text' }, 'Nothing in your history fits this search and these filters.'),
          h('button', { type: 'button', class: 'btn sm', onclick: resetFilters }, 'Clear filters')
        ]
      : [
          h('div', { class: 'empty-icon', html: CM.icon('clipboard', 22) }),
          h('div', { class: 'empty-title' }, 'Nothing saved yet'),
          h('div', { class: 'empty-text' }, 'Copy some text, then press Save. You can also turn on automatic saving in Settings.'),
          h('button', { type: 'button', class: 'btn sm btn-primary', onclick: saveClipboard }, 'Save clipboard')
        ];
    const signature = filtered ? 'filtered' : 'first-run';
    if (els.empty.hidden || els.empty.dataset.kind !== signature) {
      els.empty.dataset.kind = signature;
      els.empty.replaceChildren(...content);
    }
    els.empty.hidden = false;
  }

  function renderChrome() {
    const total = state.items.length;
    const shown = state.visible.length;
    els.count.textContent = shown === total ? plural(total, 'item') : `${shown.toLocaleString()} of ${plural(total, 'item')}`;
    els.searchClear.hidden = !state.query;

    els.app.classList.toggle('bulk', state.bulk);
    els.bulkbar.hidden = !state.bulk;
    if (state.bulk) {
      for (const id of [...state.checked]) if (!byId(id)) state.checked.delete(id);
      const count = state.checked.size;
      els.bulkCount.textContent = `${count.toLocaleString()} selected`;
      const allChecked = shown > 0 && state.visible.every((item) => state.checked.has(item.id));
      els.bulkAll.textContent = allChecked ? 'Select none' : 'Select all';
      for (const button of [els.bulkPin, els.bulkFav, els.bulkDelete]) button.disabled = count === 0;
    }
  }

  /**
   * @param {{animate?: boolean, initial?: boolean}} [options]
   */
  function render(options = {}) {
    renderChips();
    state.visible = getVisible();
    if (state.activeId && !state.visible.some((item) => item.id === state.activeId)) state.activeId = null;

    const change = () => patchList(state.visible, options.initial);
    if (options.animate && !options.initial) withListAnimation(change);
    else change();

    syncRowStates();
    renderEmpty();
    renderChrome();
  }

  /* ---------- Toasts ---------- */

  /**
   * @param {string} message
   * @param {{action?: {label: string, run: Function}}} [options]
   */
  function toast(message, options = {}) {
    els.toasts.replaceChildren();
    const el = h('div', { class: 'toast', role: 'status' }, h('span', null, message));
    const dismiss = () => {
      clearTimeout(timer);
      if (!el.isConnected || el.classList.contains('out')) return;
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    };
    if (options.action) {
      el.append(
        h(
          'button',
          {
            type: 'button',
            class: 'toast-action',
            onclick: () => {
              options.action.run();
              dismiss();
            }
          },
          options.action.label
        )
      );
    }
    const timer = setTimeout(dismiss, options.action ? 6000 : 2400);
    els.toasts.append(el);
  }

  /* ---------- Actions ---------- */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  }

  async function copyItem(item) {
    if (!(await copyText(item.text))) {
      toast('Could not copy to the clipboard');
      return;
    }
    // Confirm on the row itself instead of raising a toast
    clearTimeout(copiedTimer);
    state.copiedId = item.id;
    syncRowStates();
    copiedTimer = setTimeout(() => {
      state.copiedId = null;
      syncRowStates();
    }, 1200);
  }

  async function saveClipboard() {
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (error) {
      console.error('Clipboard read failed:', error);
      toast('Could not read the clipboard');
      return;
    }
    const result = await CM.Store.addText(text);
    if (result.error === 'empty') toast('The clipboard has no text');
    else if (result.error === 'too-long') toast(`Too long to save (limit ${CM.MAX_TEXT_LENGTH.toLocaleString()} characters)`);
    else if (result.duplicate) toast('Already saved — moved to the top');
    else els.listWrap.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function setFlag(ids, flag, value) {
    const wanted = new Set(ids);
    return CM.Store.mutate((items) => {
      for (const item of items) if (wanted.has(item.id)) item[flag] = value;
      return items;
    });
  }

  /** Delete items and offer to undo. */
  async function remove(ids, message) {
    const wanted = new Set(ids);
    let removed = [];
    await CM.Store.mutate((items) => {
      removed = items.filter((item) => wanted.has(item.id));
      return removed.length ? items.filter((item) => !wanted.has(item.id)) : undefined;
    });
    if (!removed.length) return;
    for (const item of removed) state.checked.delete(item.id);

    toast(message || `Deleted ${plural(removed.length, 'item')}`, {
      action: {
        label: 'Undo',
        run: () =>
          CM.Store.mutate((items) => {
            const present = new Set(items.map((item) => item.id));
            return [...removed.filter((item) => !present.has(item.id)), ...items];
          })
      }
    });
  }

  async function clearHistory() {
    const targets = state.items.filter((item) => !item.pinned && !item.favorite);
    if (!targets.length) {
      toast(state.items.length ? 'Only pinned items and favorites are left' : 'History is already empty');
      return;
    }
    const kept = state.items.length - targets.length;
    const ok = await CM.confirm({
      title: `Clear ${plural(targets.length, 'item')}?`,
      body: kept
        ? `${plural(kept, 'pinned or favorite item')} will be kept.`
        : 'Pin or favorite anything you want to keep first.',
      confirm: 'Clear history',
      danger: true
    });
    if (ok) await remove(targets.map((item) => item.id), `Cleared ${plural(targets.length, 'item')}`);
  }

  function update(id, patch) {
    return CM.Store.mutate((items) => {
      const item = items.find((entry) => entry.id === id);
      if (!item) return undefined;
      if ('text' in patch) {
        item.text = patch.text.slice(0, CM.MAX_TEXT_LENGTH);
        item.type = CM.detectType(item.text);
      }
      if ('title' in patch) {
        if (patch.title) item.title = patch.title.slice(0, 80);
        else delete item.title;
      }
      if ('tags' in patch) item.tags = CM.cleanTags(patch.tags);
      return items;
    });
  }

  async function create(draft) {
    const result = await CM.Store.addText(draft.text, draft);
    if (result.error === 'too-long') toast(`Too long to save (limit ${CM.MAX_TEXT_LENGTH.toLocaleString()} characters)`);
    return result;
  }

  async function openSidePanel() {
    try {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      window.close();
    } catch (error) {
      console.error('Side panel failed:', error);
      toast('Could not open the side panel');
    }
  }

  /* ---------- View state ---------- */

  function setQuery(value) {
    state.query = value;
    state.terms = value.toLowerCase().split(/\s+/).filter(Boolean);
    render();
    els.listWrap.scrollTop = 0;
  }

  function resetFilters() {
    els.search.value = '';
    state.query = '';
    state.terms = [];
    state.filter = 'all';
    state.tags.clear();
    render({ animate: true });
    els.search.focus();
  }

  function setBulk(on) {
    state.bulk = on;
    state.checked.clear();
    state.activeId = null;
    render();
  }

  function toggleChecked(id) {
    if (state.checked.has(id)) state.checked.delete(id);
    else state.checked.add(id);
    syncRowStates();
    renderChrome();
  }

  function moveActive(delta) {
    const list = state.visible;
    if (!list.length) return;
    const index = list.findIndex((item) => item.id === state.activeId);
    const next = index < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, index + delta));
    state.activeId = list[next].id;
    syncRowStates();
    rows.get(state.activeId)?.scrollIntoView({ block: 'nearest' });
  }

  const activeOrFirst = () => state.visible.find((item) => item.id === state.activeId) || state.visible[0];

  /* ---------- Events ---------- */

  function onListClick(event) {
    const row = event.target.closest('.row');
    const item = row && byId(row.dataset.id);
    if (!item) return;

    if (state.bulk) {
      toggleChecked(item.id);
      return;
    }
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'pin') setFlag([item.id], 'pinned', !item.pinned);
    else if (action === 'fav') setFlag([item.id], 'favorite', !item.favorite);
    else if (action === 'open') CM.Detail.open(item);
    else if (action === 'del') remove([item.id]);
    else copyItem(item);
  }

  function onChipClick(event) {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.filter) {
      state.filter = chip.dataset.filter;
    } else if (state.tags.has(chip.dataset.tag)) {
      state.tags.delete(chip.dataset.tag);
    } else {
      state.tags.add(chip.dataset.tag);
    }
    render({ animate: true });
    els.listWrap.scrollTop = 0;
  }

  function onMenuClick(event) {
    const action = event.target.closest('[data-menu]')?.dataset.menu;
    if (!action) return;
    els.menu.hidePopover();
    if (action === 'new') CM.Detail.open(null);
    else if (action === 'select') setBulk(true);
    else if (action === 'import') CM.Data.pickImportFile();
    else if (action === 'export') CM.Data.exportItems('json');
    else if (action === 'panel') openSidePanel();
    else if (action === 'settings') CM.Settings.open();
    else if (action === 'clear') clearHistory();
  }

  function onMenuKeydown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...els.menu.querySelectorAll('button:not([hidden])')];
    const index = items.indexOf(document.activeElement);
    const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  function onKeydown(event) {
    // Dialogs and the menu handle their own keys (Esc closes them natively)
    if (document.querySelector('dialog[open]') || els.menu.matches(':popover-open')) return;

    if (CM.Detail.isOpen() || CM.Settings.isOpen()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        CM.closeTopPanel();
      }
      return;
    }

    const target = event.target;
    const inSearch = target === els.search;
    const inOtherField = !inSearch && target.matches?.('input:not([type="checkbox"]), textarea, select');
    if (inOtherField) return;
    const mod = event.metaKey || event.ctrlKey;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
        return;

      case 'Enter': {
        if (target.closest?.('button, a')) return; // let focused buttons act normally
        const item = activeOrFirst();
        if (!item) return;
        event.preventDefault();
        if (state.bulk) toggleChecked(item.id);
        else if (event.shiftKey) CM.Detail.open(item);
        else copyItem(item);
        return;
      }

      case 'Backspace':
      case 'Delete':
        // Needs the modifier so editing the search text never deletes an item
        if (mod && state.activeId && !state.bulk) {
          event.preventDefault();
          const index = state.visible.findIndex((item) => item.id === state.activeId);
          const neighbour = state.visible[index + 1] || state.visible[index - 1];
          const id = state.activeId;
          state.activeId = neighbour ? neighbour.id : null;
          remove([id]);
        }
        return;

      case 'Escape':
        if (state.bulk) {
          event.preventDefault();
          setBulk(false);
        } else if (state.query) {
          event.preventDefault();
          els.search.value = '';
          setQuery('');
        } else if (state.activeId) {
          event.preventDefault();
          state.activeId = null;
          syncRowStates();
        }
        return; // otherwise Chrome closes the popup

      default:
        if (inSearch) return;
        if (event.key === '/' || (mod && event.key.toLowerCase() === 'f')) {
          event.preventDefault();
          els.search.focus();
          els.search.select();
        } else if (event.key.length === 1 && !mod && !event.altKey && !target.closest?.('button')) {
          els.search.focus(); // type-to-search: the keystroke lands in the field
        }
    }
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local') return;
    const settingsChange = changes[CM.KEYS.SETTINGS];
    const historyChange = changes[CM.KEYS.HISTORY];
    if (settingsChange) {
      state.settings = CM.normalizeSettings(settingsChange.newValue);
      CM.applyTheme(state.settings.theme);
    }
    if (historyChange) {
      state.items = Array.isArray(historyChange.newValue) ? historyChange.newValue : [];
    }
    if (settingsChange || historyChange) {
      render({ animate: Boolean(historyChange) });
      CM.Detail.sync();
      CM.Settings.sync();
    }
  }

  function bindEvents() {
    els.search.addEventListener('input', () => setQuery(els.search.value));
    els.searchClear.addEventListener('click', () => {
      els.search.value = '';
      setQuery('');
      els.search.focus();
    });
    els.save.addEventListener('click', saveClipboard);
    els.sort.addEventListener('click', () => {
      state.sort = state.sort === 'desc' ? 'asc' : 'desc';
      render({ animate: true });
    });
    els.chips.addEventListener('click', onChipClick);
    els.list.addEventListener('click', onListClick);

    els.menu.addEventListener('click', onMenuClick);
    els.menu.addEventListener('keydown', onMenuKeydown);
    els.menu.addEventListener('toggle', (event) => {
      const open = event.newState === 'open';
      els.menuBtn.setAttribute('aria-expanded', open);
      if (open) els.menu.querySelector('button:not([hidden])').focus();
    });

    els.bulkAll.addEventListener('click', () => {
      const allChecked = state.visible.every((item) => state.checked.has(item.id));
      for (const item of state.visible) {
        if (allChecked) state.checked.delete(item.id);
        else state.checked.add(item.id);
      }
      syncRowStates();
      renderChrome();
    });
    // Bulk pin/favorite set one value for the whole selection instead of
    // flipping each item individually.
    const bulkFlag = (flag) => {
      const selected = state.items.filter((item) => state.checked.has(item.id));
      if (selected.length) setFlag([...state.checked], flag, !selected.every((item) => item[flag]));
    };
    els.bulkPin.addEventListener('click', () => bulkFlag('pinned'));
    els.bulkFav.addEventListener('click', () => bulkFlag('favorite'));
    els.bulkDelete.addEventListener('click', () => remove([...state.checked]));
    els.bulkDone.addEventListener('click', () => setBulk(false));

    document.addEventListener('keydown', onKeydown);
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  async function init() {
    Object.assign(els, {
      app: $('#app'),
      search: $('#search'),
      searchClear: $('#search-clear'),
      save: $('#save-btn'),
      menuBtn: $('#menu-btn'),
      menu: $('#menu'),
      chips: $('#chips'),
      sort: $('#sort-btn'),
      listWrap: $('#list-wrap'),
      list: $('#list'),
      empty: $('#empty'),
      count: $('#count'),
      toasts: $('#toasts'),
      bulkbar: $('#bulkbar'),
      bulkCount: $('#bulk-count'),
      bulkAll: $('#bulk-all'),
      bulkPin: $('#bulk-pin'),
      bulkFav: $('#bulk-fav'),
      bulkDelete: $('#bulk-delete'),
      bulkDone: $('#bulk-done')
    });

    CM.app = {
      state,
      toast,
      allTags,
      actions: {
        copyText,
        setFlag,
        remove,
        update,
        create,
        clearHistory,
        setSettings: (patch) => CM.Store.setSettings(patch)
      }
    };

    CM.hydrateIcons();
    $('#menu-panel').hidden = document.documentElement.classList.contains('in-sidepanel') || !chrome.sidePanel;
    bindEvents();
    CM.Detail.init();
    CM.Settings.init();
    CM.Data.init();

    try {
      const { items, settings } = await CM.Store.read();
      state.items = items;
      state.settings = settings;
      CM.applyTheme(settings.theme);
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
      toast('Could not load your clipboard history');
    }
    render({ initial: true });
    els.search.focus();

    // Keep relative times fresh while the side panel stays open
    setInterval(() => {
      if (!document.hidden) render();
    }, 60000);

    // The permission can be revoked from Chrome's own UI while we were closed
    if (state.settings.autoCapture) {
      const granted = await chrome.permissions.contains(CM.ALL_URLS).catch(() => false);
      if (!granted) CM.Store.setSettings({ autoCapture: false });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
