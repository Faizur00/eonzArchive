/**
 * EonzArchive - Client-Side Hash Router Module
 */

const Router = {
  isNavigating: false,

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    // Initial route dispatch
    this.handleRoute();
  },

  navigate(path, replace = false) {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const targetHash = '#' + cleanPath;
    
    if (window.location.hash === targetHash) {
      this.handleRoute();
      return;
    }

    if (replace) {
      const url = window.location.pathname + window.location.search + targetHash;
      window.location.replace(url);
    } else {
      window.location.hash = targetHash;
    }
  },

  getHashPath() {
    const hash = window.location.hash.slice(1) || '/';
    return hash.split('?')[0] || '/';
  },

  getQueryParams() {
    const hash = window.location.hash.slice(1);
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return {};
    const qs = hash.slice(qIndex + 1);
    const params = {};
    for (const [k, v] of new URLSearchParams(qs).entries()) {
      params[k] = v;
    }
    return params;
  },

  async handleRoute() {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      const path = this.getHashPath();
      const params = this.getQueryParams();

      // Route: /read/:id
      const readMatch = path.match(/^\/read\/([^/?#]+)/);
      if (readMatch) {
        const bookId = decodeURIComponent(readMatch[1]);
        await this.handleReadRoute(bookId, params);
        return;
      }

      // Route: /folder/:id
      const folderMatch = path.match(/^\/folder\/([^/?#]+)/);
      if (folderMatch) {
        const folderId = decodeURIComponent(folderMatch[1]);
        await this.handleFolderRoute(folderId, params);
        return;
      }

      // Default route: / or /library
      await this.handleLibraryRootRoute(params);
    } catch (err) {
      console.error('Routing error:', err);
    } finally {
      this.isNavigating = false;
    }
  },

  async handleReadRoute(bookId, params = {}) {
    // If book is already open in reader, don't re-render
    if (State.currentBook && State.currentBook.fileId === bookId && document.getElementById('readerView').style.display !== 'none') {
      return;
    }

    // Try finding book from current State.books
    let book = State.books.find(b => b.id === bookId);
    if (!book) {
      try {
        book = await API.getBookInfo(bookId);
      } catch (e) {
        console.warn('Could not fetch book info for route:', e);
      }
    }

    const title = book ? book.name : (params.name || 'Untitled Document');
    const format = book ? book.format : (params.format || 'EPUB');

    await Reader.openBook(bookId, title, format, false);
  },

  async handleFolderRoute(folderId, params = {}) {
    if (document.getElementById('readerView').style.display !== 'none') {
      Reader.exitReaderDOM();
    }

    if (params.format) {
      State.formatFilter = params.format;
      this.syncFilterPill(params.format);
    }
    if (params.sort) {
      State.sortBy = params.sort;
      const sortEl = document.getElementById('sortSelect');
      if (sortEl) sortEl.value = params.sort;
    }

    await Library.loadFolder(folderId, false);
  },

  async handleLibraryRootRoute(params = {}) {
    if (document.getElementById('readerView').style.display !== 'none') {
      Reader.exitReaderDOM();
    }

    if (params.format) {
      State.formatFilter = params.format;
      this.syncFilterPill(params.format);
    }
    if (params.sort) {
      State.sortBy = params.sort;
      const sortEl = document.getElementById('sortSelect');
      if (sortEl) sortEl.value = params.sort;
    }

    await Library.loadFolder(null, false);
  },

  syncFilterPill(format) {
    document.querySelectorAll('.pill-btn[data-format]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-format') === format);
    });
  }
};

window.Router = Router;
