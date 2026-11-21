/**
 * Runs in <head> before first paint so the saved theme never flashes.
 * localStorage mirrors the theme setting because chrome.storage is async.
 */
(() => {
  const root = document.documentElement;
  try {
    const theme = localStorage.getItem('cm-theme');
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  } catch {
    /* storage unavailable: follow the system theme */
  }
  if (new URLSearchParams(location.search).has('panel')) root.classList.add('in-sidepanel');
})();
