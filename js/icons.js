/**
 * Inline SVG icons (Feather-style strokes). All markup here is static and
 * trusted; user content is never passed through CM.icon.
 */
'use strict';

(() => {
  const PATHS = {
    search: '<circle cx="11" cy="11" r="7"/><line x1="20.5" y1="20.5" x2="16.2" y2="16.2"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    text: '<line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
    float: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="7" height="6" rx="1"/>',
    select: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    sortDesc: '<polyline points="3 16 7 20 11 16"/><line x1="7" y1="20" x2="7" y2="4"/><line x1="11" y1="4" x2="21" y2="4"/><line x1="11" y1="8" x2="18" y2="8"/><line x1="11" y1="12" x2="15" y2="12"/>',
    sortAsc: '<polyline points="3 8 7 4 11 8"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="11" y1="12" x2="15" y2="12"/><line x1="11" y1="16" x2="18" y2="16"/><line x1="11" y1="20" x2="21" y2="20"/>'
  };

  /**
   * Empty-state artwork: a clipboard on a tilted blob. Colours come from the
   * `.art-*` classes in styles.css, so it follows the theme.
   */
  const EMPTY_ART =
    '<svg class="art" viewBox="330 120 770 840" aria-hidden="true" focusable="false">' +
    '<defs>' +
    '<linearGradient id="art-g-blob" x1="0" y1="0" x2="1" y2="1"><stop class="art-blob-a" offset="0"/><stop class="art-blob-b" offset="1"/></linearGradient>' +
    '<linearGradient id="art-g-paper" x1="0" y1="0" x2="0.4" y2="1"><stop class="art-paper-a" offset="0"/><stop class="art-paper-b" offset="1"/></linearGradient>' +
    '<linearGradient id="art-g-clip" x1="0" y1="0" x2="0" y2="1"><stop class="art-clip-a" offset="0"/><stop class="art-clip-b" offset="1"/></linearGradient>' +
    '<clipPath id="art-c-blob"><rect x="387" y="290.5" width="654" height="607" rx="150" transform="rotate(-17 714 594)"/></clipPath>' +
    '</defs>' +
    '<rect x="387" y="290.5" width="654" height="607" rx="150" transform="rotate(-17 714 594)" fill="url(#art-g-blob)"/>' +
    '<circle class="art-swell" cx="880" cy="760" r="185" clip-path="url(#art-c-blob)"/>' +
    '<g class="art-sparks"><line x1="936" y1="150" x2="918" y2="202"/><line x1="1016" y1="197" x2="975" y2="238"/><line x1="1057" y1="286" x2="1010" y2="297"/></g>' +
    '<g class="art-board">' +
    '<rect x="544" y="406" width="356" height="386" rx="68" fill="url(#art-g-paper)"/>' +
    '<g class="art-lines"><rect x="606" y="518" width="232" height="30" rx="15"/><rect x="606" y="584" width="192" height="30" rx="15"/><rect x="606" y="651" width="140" height="30" rx="15"/></g>' +
    '<g fill="url(#art-g-clip)"><circle cx="722" cy="378" r="43"/><rect x="639" y="378" width="167" height="63" rx="22"/></g>' +
    '<circle class="art-hole" cx="722" cy="376" r="15"/>' +
    '</g>' +
    '</svg>';

  /** @returns {string} static SVG markup for the first-run empty state */
  CM.emptyArt = () => EMPTY_ART;

  /**
   * @param {string} name
   * @param {number} [size]
   * @param {boolean} [filled]
   * @returns {string} SVG markup
   */
  CM.icon = (name, size = 16, filled = false) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" ` +
    `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;

  /** Fill every `[data-icon]` placeholder in the static markup. */
  CM.hydrateIcons = (root = document) => {
    for (const el of root.querySelectorAll('[data-icon]')) {
      el.innerHTML = CM.icon(el.dataset.icon, Number(el.dataset.iconSize) || 16);
    }
  };
})();
