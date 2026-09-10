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
  theme: localStorage.getItem('eonz.theme') || 'dark',

  // Reader Settings
  readerMode: localStorage.getItem('eonz.reader.mode') || 'single',
  readerWidth: localStorage.getItem('eonz.reader.width') || 'standard',
  readerFontSize: parseFloat(localStorage.getItem('eonz.spacing.font') || '1'),
  readerWordSpacing: parseFloat(localStorage.getItem('eonz.spacing.word') || '0'),
  readerLetterSpacing: parseFloat(localStorage.getItem('eonz.spacing.letter') || '0'),
  pdfZoom: 1,

  // Runtime objects
  currentBook: null,
  currentRendition: null,
  isBuildingRendition: false,
  
  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('eonz.theme', theme);
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
    if (preset === 'compact') frame.style.width = '50vw';
    else if (preset === 'standard') frame.style.width = '65vw';
    else if (preset === 'wide') frame.style.width = '80vw';
    else if (preset === 'full') frame.style.width = '96vw';
  }
};

window.State = State;
