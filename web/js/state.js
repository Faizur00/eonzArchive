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
