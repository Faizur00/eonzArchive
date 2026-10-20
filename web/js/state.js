/**
 * EonzArchive State Management Module
 */

const State = {
  currentFolderId: null,
  breadcrumbs: [],
  folders: [],
  books: [],
  stats: null,
  
  // Filters & Controls
  formatFilter: 'ALL',
  cachedOnly: false,
  sortBy: 'name',
  viewMode: localStorage.getItem('eonz.viewMode') || 'grid', // 'grid' or 'list'

  // App Theme (single source of truth for the whole webapp, including the reader)
  // An explicit choice in localStorage wins; otherwise follow the system.
  theme: localStorage.getItem('eonz.theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),

  // Reader Settings
  readerMode: localStorage.getItem('eonz.reader.mode') || 'single',
  readerWidth: localStorage.getItem('eonz.reader.width') || 'standard',
  readerFontSize: parseFloat(localStorage.getItem('eonz.spacing.font') || '1'),
  readerWordSpacing: parseFloat(localStorage.getItem('eonz.spacing.word') || '0'),
  readerLetterSpacing: parseFloat(localStorage.getItem('eonz.spacing.letter') || '0'),
  readerLineHeight: parseFloat(localStorage.getItem('eonz.spacing.line') || '1.6'),
  readerFontFamily: localStorage.getItem('eonz.reader.font') || 'serif',
  readerTextAlign: localStorage.getItem('eonz.reader.align') || 'left',
  pdfZoom: 1,

  // Runtime objects
  currentBook: null,
  currentRendition: null,
  isBuildingRendition: false,
  
  setTheme(theme, { persist = true } = {}) {
    this.theme = theme;
    if (persist) localStorage.setItem('eonz.theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    updateFavicon(theme);
  },

  setViewMode(mode) {
    this.viewMode = mode;
    localStorage.setItem('eonz.viewMode', mode);
  },

  setReaderWidth(preset) {
    this.readerWidth = preset;
    localStorage.setItem('eonz.reader.width', preset);
    const frame = document.getElementById('readerFrame');
    if (!frame) return;
    if (window.innerWidth <= 768) {
      frame.style.width = '100vw';
      return;
    }
    if (preset === 'compact') frame.style.width = 'min(50vw, 520px)';
    else if (preset === 'standard') frame.style.width = 'min(65vw, 680px)';
    else if (preset === 'wide') frame.style.width = 'min(80vw, 820px)';
    else if (preset === 'full') frame.style.width = 'min(96vw, 1000px)';
  }
};

window.State = State;

/**
 * Point the favicon at the variant that matches the given theme.
 * Uses window.__FAVICON_CONFIG defined in index.html as the single source of truth.
 */
function updateFavicon(theme) {
  const cfg = window.__FAVICON_CONFIG || { light: '/ico_final_light.svg', dark: '/ico_final_dark.svg' };
  const targetHref = theme === 'dark' ? cfg.dark : cfg.light;
  
  // If the user has explicitly chosen an in-app theme override, remove media queries so it doesn't conflict
  const favLight = document.getElementById('faviconLight');
  const favDark = document.getElementById('faviconDark');
  const appFavicon = document.getElementById('appFavicon');

  if (localStorage.getItem('eonz.theme')) {
    if (favLight) favLight.remove();
    if (favDark) favDark.remove();
  }

  if (appFavicon) {
    appFavicon.setAttribute('href', targetHref);
  } else {
    const link = document.createElement('link');
    link.id = 'appFavicon';
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = targetHref;
    document.head.appendChild(link);
  }
}

window.updateFavicon = updateFavicon;

