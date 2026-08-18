/**
 * EonzArchive - Reader Engine & Controller Module (Swiss Minimalist & Old Archive)
 */

const Reader = {
  savePositionTimer: null,
  chaptersList: [],

  init() {
    this.bindEvents();
    this.applySettingsToDOM();
  },

  bindEvents() {
    // Mode switcher
    const modeSelect = document.getElementById('readerModeSelect');
    if (modeSelect) {
      modeSelect.value = State.readerMode;
      modeSelect.addEventListener('change', async (e) => {
        State.readerMode = e.target.value;
        localStorage.setItem('eonz.reader.mode', State.readerMode);
        if (State.currentBook) {
          await this.rebuildRendition();
        }
      });
    }

    // TOC Toggle
    const tocBtn = document.getElementById('tocToggleBtn');
    const tocCloseBtn = document.getElementById('tocCloseBtn');
    const tocBackdrop = document.getElementById('tocBackdrop');
    if (tocBtn) tocBtn.addEventListener('click', () => this.toggleTOC(true));
    if (tocCloseBtn) tocCloseBtn.addEventListener('click', () => this.toggleTOC(false));
    if (tocBackdrop) tocBackdrop.addEventListener('click', () => this.toggleTOC(false));

    // TOC Search
    const tocSearch = document.getElementById('tocSearchInput');
    if (tocSearch) {
      tocSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        this.filterTOC(query);
      });
    }

    // Appearance / Settings Popover Toggle
    const settingsBtn = document.getElementById('readerSettingsBtn');
    const popover = document.getElementById('readerSettingsPopover');
    if (settingsBtn && popover) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && e.target !== settingsBtn) {
          popover.classList.remove('open');
        }
      });
    }

    // Theme selector buttons inside popover
    document.querySelectorAll('.reader-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-rtheme');
        State.setReaderTheme(t);
        document.querySelectorAll('.reader-theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyReadingStyles();
      });
    });

    // Width presets inside popover
    document.querySelectorAll('.width-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const w = btn.getAttribute('data-width');
        State.setReaderWidth(w);
        document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (State.currentBook) {
          await this.rebuildRendition();
        }
      });
    });

    // Font size steppers
    const fontDec = document.getElementById('fontDecBtn');
    const fontInc = document.getElementById('fontIncBtn');
    if (fontDec && fontInc) {
      fontDec.addEventListener('click', () => this.adjustFontSize(-0.1));
      fontInc.addEventListener('click', () => this.adjustFontSize(0.1));
    }

    // Word & Letter spacing sliders
    const wordSlider = document.getElementById('wordSpacingSlider');
    const letterSlider = document.getElementById('letterSpacingSlider');
    if (wordSlider) {
      wordSlider.value = State.readerWordSpacing;
      wordSlider.addEventListener('input', (e) => {
        State.readerWordSpacing = parseFloat(e.target.value) || 0;
        localStorage.setItem('eonz.spacing.word', String(State.readerWordSpacing));
        this.applyReadingStyles();
      });
    }
    if (letterSlider) {
      letterSlider.value = State.readerLetterSpacing;
      letterSlider.addEventListener('input', (e) => {
        State.readerLetterSpacing = parseFloat(e.target.value) || 0;
        localStorage.setItem('eonz.spacing.letter', String(State.readerLetterSpacing));
        this.applyReadingStyles();
      });
    }

    // Fullscreen toggle
    const fullscreenBtn = document.getElementById('fullscreenToggleBtn');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Hotspot Chevrons
    const prevHotspot = document.getElementById('navHotspotPrev');
    const nextHotspot = document.getElementById('navHotspotNext');
    if (prevHotspot) prevHotspot.addEventListener('click', () => this.prevPage());
    if (nextHotspot) nextHotspot.addEventListener('click', () => this.nextPage());

    // Window resize handler for automatic reflow
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      const readerView = document.getElementById('readerView');
      if (readerView && readerView.style.display !== 'none' && State.currentBook && !State.isBuildingRendition) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          this.rebuildRendition();
        }, 250);
      }
    });

    // Global Keybindings for Reader
    window.addEventListener('keydown', (e) => {
      if (document.getElementById('readerView').style.display !== 'none') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          if (document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            this.nextPage();
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          if (document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            this.prevPage();
          }
        } else if (e.key === 'Escape') {
          if (this.isFootnoteOpen()) {
            this.closeFootnote();
          } else if (document.getElementById('tocDrawer').classList.contains('open')) {
            this.toggleTOC(false);
          } else {
            this.closeReader();
          }
        }
      }
    });

    window.addEventListener('beforeunload', () => this.savePositionNow());
  },

  applySettingsToDOM() {
    State.setReaderTheme(State.readerTheme);
    State.setReaderWidth(State.readerWidth);
    
    // Highlight active popover buttons
    const activeThemeBtn = document.querySelector(`.reader-theme-btn[data-rtheme="${State.readerTheme}"]`);
    if (activeThemeBtn) activeThemeBtn.classList.add('active');
    
    const activeWidthBtn = document.querySelector(`.width-btn[data-width="${State.readerWidth}"]`);
    if (activeWidthBtn) activeWidthBtn.classList.add('active');
    
    this.updateFontSizeDisplay();
  },

  updateFontSizeDisplay() {
    const label = document.getElementById('fontSizeLabel');
    if (label) label.textContent = `${Math.round(State.readerFontSize * 100)}%`;
  },

  adjustFontSize(delta) {
    State.readerFontSize = Math.min(2.5, Math.max(0.6, State.readerFontSize + delta));
    localStorage.setItem('eonz.spacing.font', String(State.readerFontSize));
    this.updateFontSizeDisplay();
    this.applyReadingStyles();
  },

  showLoading(title, detail = '') {
    const overlay = document.getElementById('loadingOverlay');
    const titleEl = document.getElementById('loadingTitle');
    const detailEl = document.getElementById('loadingDetail');
    if (overlay) overlay.style.display = 'flex';
    if (titleEl) titleEl.textContent = title;
    if (detailEl) detailEl.textContent = detail;
  },

  hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
  },

  async openBook(fileId, bookName, format = 'EPUB', updateUrl = true) {
    if (updateUrl && window.Router) {
      Router.navigate(`/read/${fileId}`);
    }

    if (window.__kookitReady) await window.__kookitReady;
    
    document.getElementById('libraryView').style.display = 'none';
    document.getElementById('readerView').style.display = 'flex';

    document.getElementById('readerBookTitle').textContent = bookName;
    const formatBadge = document.getElementById('readerFormatBadge');
    if (formatBadge) {
      formatBadge.textContent = format.toUpperCase();
      formatBadge.className = `badge badge-${format.toLowerCase()}`;
    }

    // Toggle PDF / reflowable controls
    const isPdf = format.toUpperCase() === 'PDF';
    const pdfControls = document.getElementById('pdfZoomControls');
    const spacingControls = document.getElementById('spacingControlsGroup');
    if (pdfControls) pdfControls.style.display = isPdf ? 'inline-flex' : 'none';
    if (spacingControls) spacingControls.style.display = isPdf ? 'none' : 'flex';

    State.pdfZoom = 1;
    this.updatePdfZoomLabel();

    const pageArea = document.getElementById('page-area');
    if (pageArea) pageArea.innerHTML = '';

    this.showLoading('RETRIEVING DOCUMENT...', 'Loading document structure...');

    try {
      const startTime = Date.now();
      const res = await fetch(`/api/book/${fileId}/stream`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const buffer = await res.arrayBuffer();
      const fetchTime = Date.now() - startTime;
      console.log(`Document "${bookName}" fetched in ${fetchTime}ms (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB).`);

      State.currentBook = {
        fileId,
        name: bookName,
        format: format.toUpperCase(),
        buffer
      };

      await this.buildRendition();
      showToast('Document Ready', `Opened "${bookName}"`, 'success');
    } catch (err) {
      console.error('Error reading book:', err);
      this.showLoading('Failed to Open Document', err.message);
      setTimeout(() => this.hideLoading(), 3500);
    }
  },

  async buildRendition(overrides = {}) {
    if (!State.currentBook) return;
    const { fileId, format, buffer } = State.currentBook;

    State.isBuildingRendition = true;
    this.showLoading('INITIALIZING RENDERING ENGINE...', `Configuring typography for ${format}...`);

    try {
      if (!window.Kookit) {
        throw new Error('Kookit library engine is not loaded.');
      }

      window.transMap = window.transMap || {};

      const bgMap = {
        bone: '#f4f4f0',
        light: '#ffffff',
        oled: '#000000',
        dark: '#171a1d'
      };

      const config = Object.assign({
        format: format,
        readerMode: State.readerMode,
        animation: 'none',
        charset: 'utf-8',
        isDarkMode: State.readerTheme === 'dark' || State.readerTheme === 'oled' ? 'yes' : 'no',
        convertChinese: 'no',
        isConvertPDF: 'no',
        isMobile: 'no',
        backgroundColor: bgMap[State.readerTheme] || '#171a1d'
      }, overrides);

      let rendition = null;
      if (window.Kookit.BookHelper && typeof window.Kookit.BookHelper.getRendition === 'function') {
        rendition = window.Kookit.BookHelper.getRendition(buffer, config, window.Kookit);
      } else {
        const fmt = format.toUpperCase();
        if (fmt === 'EPUB' && window.Kookit.EpubRender) {
          rendition = new window.Kookit.EpubRender(buffer, config);
        } else if ((fmt === 'MOBI' || fmt === 'AZW3') && window.Kookit.MobiRender) {
          rendition = new window.Kookit.MobiRender(buffer, config);
        } else if (fmt === 'PDF' && window.Kookit.PdfRender) {
          rendition = new window.Kookit.PdfRender(buffer, config);
        } else if (fmt === 'TXT' && window.Kookit.TxtRender) {
          rendition = new window.Kookit.TxtRender(buffer, config);
        } else if (fmt === 'MD' && window.Kookit.MdRender) {
          rendition = new window.Kookit.MdRender(buffer, config);
        }
      }

      if (!rendition) {
        throw new Error(`No compatible renderer found for ${format}`);
      }

      State.currentRendition = rendition;
      window.rendition = rendition;

      const pageArea = document.getElementById('page-area');
      if (pageArea) {
        pageArea.style.overflowY = (State.readerMode === 'scroll') ? 'auto' : 'hidden';
        pageArea.innerHTML = '';
      }

      await rendition.renderTo(pageArea);

      this.attachIframeInterceptors(rendition);

      let restored = false;
      const saved = localStorage.getItem(`eonz.reading.${fileId}`);
      if (saved) {
        try {
          const pos = JSON.parse(saved);
          if (pos && (pos.chapterDocIndex !== undefined || pos.xpath || pos.href)) {
            await rendition.goToPosition(saved);
            restored = true;
          }
        } catch (e) {
          console.warn('Failed to restore position:', e);
        }
      }

      if (!restored) {
        if (rendition.chapterDocList && rendition.chapterDocList.length > 0) {
          await rendition.goToChapterDocIndex(0);
        } else if (typeof rendition.goToChapter === 'function') {
          await rendition.goToChapter(0);
        }
      }

      await this.populateTOC(rendition);

      if (rendition.on) {
        rendition.on('rendered', () => {
          this.applyReadingStyles();
        });
        rendition.on('page-changed', () => {
          this.onPageChanged();
        });
      }

      this.savePositionNow();
      this.applyReadingStyles();
    } finally {
      State.isBuildingRendition = false;
      this.hideLoading();
    }
  },

  attachIframeInterceptors(rendition) {
    const epubDoc = rendition.getDocument && rendition.getDocument();
    const epubIframe = rendition.getIframe && rendition.getIframe();
    if (!epubDoc || !epubIframe || epubDoc.__kookitEventsAttached) return;

    epubDoc.__kookitEventsAttached = true;
    epubDoc.addEventListener('click', async (e) => {
      try {
        if (this.isFootnoteOpen() && !e.target.closest('#footnotePopup')) {
          this.closeFootnote();
        }

        const href = rendition.getTargetHref ? rendition.getTargetHref(e) : '';
        if (!href) return;
        e.preventDefault();
        e.stopPropagation();

        const result = await rendition.handleLinkJump(href, e);
        if (!result || !result.handled) return;

        if (result.external) {
          if (result.href) window.open(result.href, '_blank', 'noopener');
          return;
        }

        if (result.isShowMenu && result.node && typeof rendition.getFootnoteContent === 'function') {
          const foot = await rendition.getFootnoteContent(result.node);
          if (foot && foot.handled && foot.content) {
            this.showFootnote(foot.content, epubIframe, e);
            return;
          }
        }

        if (result.handled && href.indexOf('#') === 0 && epubDoc) {
          const id = href.split('#')[1];
          const node = id ? epubDoc.body.querySelector('#' + CSS.escape(id)) : null;
          if (node && typeof rendition.goToNode === 'function') {
            await rendition.goToNode(node);
          }
        }
      } catch (err) {
        console.warn('Iframe link handling error:', err);
      }
    });
  },

  async rebuildRendition() {
    if (!State.currentBook) return;
    this.savePositionNow();
    try {
      await this.buildRendition();
    } catch (e) {
      console.error('Rebuild failed:', e);
    }
  },

  onPageChanged() {
    if (!State.currentRendition) return;
    const pos = typeof State.currentRendition.getPosition === 'function' ? State.currentRendition.getPosition() : null;
    
    const chapIndicator = document.getElementById('readerChapterIndicator');
    if (chapIndicator && pos) {
      const idx = pos.chapterDocIndex !== undefined ? pos.chapterDocIndex + 1 : 1;
      chapIndicator.textContent = `SECTION ${idx}`;
    }

    if (pos && pos.chapterDocIndex !== undefined) {
      document.querySelectorAll('.toc-item').forEach(el => {
        const cIndex = parseInt(el.getAttribute('data-chapter-index'), 10);
        el.classList.toggle('active', cIndex === pos.chapterDocIndex);
      });
    }

    this.savePositionDebounced();
  },

  applyReadingStyles() {
    if (!State.currentRendition || typeof State.currentRendition.getDocument !== 'function') return;
    const doc = State.currentRendition.getDocument();
    if (!doc || !doc.head) return;

    let style = doc.getElementById('eonz-reader-custom-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'eonz-reader-custom-style';
      doc.head.appendChild(style);
    }

    let bg = '#171a1d';
    let text = '#eceff2';
    if (State.readerTheme === 'bone') {
      bg = '#f4f4f0';
      text = '#1f2226';
    } else if (State.readerTheme === 'light') {
      bg = '#ffffff';
      text = '#181a1c';
    } else if (State.readerTheme === 'oled') {
      bg = '#000000';
      text = '#d8dbe0';
    }

    style.textContent = `
      html, body {
        background-color: ${bg} !important;
        color: ${text} !important;
        font-family: 'Crimson Pro', 'EB Garamond', Georgia, serif !important;
      }
      body {
        word-spacing: ${State.readerWordSpacing}px !important;
        letter-spacing: ${State.readerLetterSpacing}px !important;
        font-size: ${Math.round(State.readerFontSize * 100)}% !important;
      }
      body p, body div, body span, body li, body a, body blockquote {
        word-spacing: inherit !important;
        letter-spacing: inherit !important;
      }
    `;
  },

  async populateTOC(rendition) {
    const listEl = document.getElementById('tocList');
    if (!listEl) return;
    listEl.innerHTML = '<li style="padding: 14px 18px; color: var(--text-muted); font-size: 13px;">INDEXING CHAPTERS...</li>';

    try {
      let chapters = [];
      if (typeof rendition.getChapter === 'function') {
        chapters = await rendition.getChapter() || [];
      } else if (rendition.chapterList) {
        chapters = rendition.chapterList;
      }

      this.chaptersList = chapters || [];
      this.renderTOCList(this.chaptersList);
    } catch (err) {
      listEl.innerHTML = '<li style="padding: 14px 18px; color: var(--text-muted); font-size: 13px;">NO INDEX AVAILABLE.</li>';
    }
  },

  renderTOCList(chapters) {
    const listEl = document.getElementById('tocList');
    if (!listEl) return;

    if (!chapters || chapters.length === 0) {
      listEl.innerHTML = '<li style="padding: 14px 18px; color: var(--text-muted); font-size: 13px;">NO CHAPTERS FOUND.</li>';
      return;
    }

    listEl.innerHTML = chapters.map((ch, idx) => `
      <li class="toc-item" data-chapter-index="${ch.index !== undefined ? ch.index : idx}" onclick="Reader.jumpToChapter(${ch.index !== undefined ? ch.index : idx})">
        <span>${escapeHtml(ch.label || `Section ${idx + 1}`)}</span>
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </li>
    `).join('');
  },

  filterTOC(query) {
    if (!query) {
      this.renderTOCList(this.chaptersList);
      return;
    }
    const filtered = this.chaptersList.filter(c => (c.label || '').toLowerCase().includes(query));
    this.renderTOCList(filtered);
  },

  toggleTOC(open) {
    const drawer = document.getElementById('tocDrawer');
    const backdrop = document.getElementById('tocBackdrop');
    if (drawer) drawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
  },

  jumpToChapter(index) {
    this.closeFootnote();
    this.toggleTOC(false);
    if (State.currentRendition && typeof State.currentRendition.goToChapter === 'function') {
      State.currentRendition.goToChapter(parseInt(index, 10));
    }
  },

  nextPage() {
    if (this.isFootnoteOpen()) { this.closeFootnote(); return; }
    if (State.currentRendition && typeof State.currentRendition.next === 'function') {
      State.currentRendition.next();
    }
  },

  prevPage() {
    if (this.isFootnoteOpen()) { this.closeFootnote(); return; }
    if (State.currentRendition && typeof State.currentRendition.prev === 'function') {
      State.currentRendition.prev();
    }
  },

  updatePdfZoomLabel() {
    const label = document.getElementById('pdfZoomLabel');
    if (label) label.textContent = `${Math.round(State.pdfZoom * 100)}%`;
  },

  async zoomPdf(factor) {
    if (!State.currentBook || State.currentBook.format !== 'PDF') return;
    State.pdfZoom = Math.min(3, Math.max(0.5, State.pdfZoom * factor));
    this.updatePdfZoomLabel();

    const frame = document.getElementById('readerFrame');
    if (frame) {
      frame.style.width = `${65 * State.pdfZoom}vw`;
      frame.style.height = `${100 * State.pdfZoom}%`;
    }
    await this.rebuildRendition();
  },

  async resetPdfZoom() {
    if (!State.currentBook || State.currentBook.format !== 'PDF') return;
    State.pdfZoom = 1;
    this.updatePdfZoomLabel();
    const frame = document.getElementById('readerFrame');
    if (frame) {
      frame.style.width = '65vw';
      frame.style.height = '100%';
    }
    await this.rebuildRendition();
  },

  showFootnote(html, iframe, evt) {
    const popup = document.getElementById('footnotePopup');
    const content = document.getElementById('footnoteContent');
    const frame = document.getElementById('readerFrame');
    if (!popup || !content || !frame) return;

    content.innerHTML = html;
    popup.style.display = 'block';

    const frameRect = frame.getBoundingClientRect();
    const iframeRect = iframe.getBoundingClientRect();
    const x = iframeRect.left + evt.clientX;
    const y = iframeRect.top + evt.clientY;
    const pw = popup.offsetWidth || 340;
    const ph = popup.offsetHeight || 160;

    let left = x + 16;
    let top = y + 16;
    if (left + pw > frameRect.right - 10) left = x - pw - 16;
    left = Math.max(frameRect.left + 10, Math.min(left, frameRect.right - pw - 10));
    if (top + ph > frameRect.bottom - 10) top = y - ph - 16;
    top = Math.max(frameRect.top + 10, Math.min(top, frameRect.bottom - ph - 10));

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  },

  closeFootnote() {
    const popup = document.getElementById('footnotePopup');
    if (popup) popup.style.display = 'none';
  },

  isFootnoteOpen() {
    const popup = document.getElementById('footnotePopup');
    return popup && popup.style.display !== 'none';
  },

  savePositionNow() {
    if (State.isBuildingRendition || !State.currentBook || !State.currentRendition) return;
    if (typeof State.currentRendition.getPosition !== 'function') return;
    try {
      const pos = State.currentRendition.getPosition();
      if (pos) {
        localStorage.setItem(`eonz.reading.${State.currentBook.fileId}`, JSON.stringify(pos));
      }
    } catch (e) {
      console.warn('Failed to save position:', e);
    }
  },

  savePositionDebounced() {
    clearTimeout(this.savePositionTimer);
    this.savePositionTimer = setTimeout(() => this.savePositionNow(), 400);
  },

  async restoreReadingPosition() {
    if (!State.currentBook || !State.currentRendition) return;
    if (typeof State.currentRendition.goToPosition !== 'function') return;
    const saved = localStorage.getItem(`eonz.reading.${State.currentBook.fileId}`);
    if (!saved) return;
    try {
      const pos = JSON.parse(saved);
      if (pos && (pos.chapterDocIndex !== undefined || pos.xpath || pos.href)) {
        await State.currentRendition.goToPosition(saved);
      }
    } catch (e) {
      console.warn('Failed to restore position:', e);
    }
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  },

  closeReader() {
    this.closeFootnote();
    this.toggleTOC(false);
    this.savePositionNow();

    if (window.location.hash.startsWith('#/read/')) {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        Router.navigate(State.currentFolderId ? `/folder/${State.currentFolderId}` : '/');
      }
    } else {
      this.exitReaderDOM();
    }
  },

  exitReaderDOM() {
    this.closeFootnote();
    this.toggleTOC(false);
    this.savePositionNow();

    document.getElementById('readerView').style.display = 'none';
    document.getElementById('libraryView').style.display = 'block';

    const pageArea = document.getElementById('page-area');
    if (pageArea) pageArea.innerHTML = '';
    State.currentRendition = null;
    State.currentBook = null;
  }
};

window.Reader = Reader;
