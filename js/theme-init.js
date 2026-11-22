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
  // The same page serves the popup, the side panel and the floating window.
  const params = new URLSearchParams(location.search);
  if (params.has('panel')) root.classList.add('in-sidepanel');
  else if (params.has('window')) root.classList.add('in-window');
})();
