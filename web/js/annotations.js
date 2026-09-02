/**
 * EonzArchive - Annotations Engine & Controller Module
 * Supports Text Highlighting, Free Draw Brush, and Annotations Management
 */

if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

const Annotations = {
  items: [],
  activeTool: 'none', // 'none', 'highlight', 'draw'
  activeHighlightColor: 'color-0',
  brushColor: '#f59e0b',
  brushWidth: 3,
  brushMode: 'pen', // 'pen' or 'eraser'
  
  // Drawing runtime state
  drawingCanvas: null,
  drawingCtx: null,
  isDrawingActive: false,
  currentStroke: null,
  currentChapterDocIndex: 0,
  drawingHistory: [],

  // Floating selection UI
  selectionToolbar: null,
  currentSelectionRange: null,
  currentSelectedText: '',
  currentSelectionRect: null,

  init() {
    this.createDOMContainers();
    this.bindEvents();
  },

  createDOMContainers() {
    // 1. Floating Text Selection Toolbar
    if (!document.getElementById('floatingSelectionToolbar')) {
      const bar = document.createElement('div');
      bar.id = 'floatingSelectionToolbar';
      bar.className = 'floating-selection-toolbar';
      bar.innerHTML = `
        <div class="color-palette">
          <button class="color-swatch-btn color-0" data-color="color-0" title="Yellow Highlight"></button>
          <button class="color-swatch-btn color-1" data-color="color-1" title="Green Highlight"></button>
          <button class="color-swatch-btn color-2" data-color="color-2" title="Mint Highlight"></button>
          <button class="color-swatch-btn color-3" data-color="color-3" title="Sky Highlight"></button>
          <button class="color-swatch-btn line-0" data-color="line-0" title="Red Underline"><u>U</u></button>
        </div>
        <div class="toolbar-divider"></div>
        <button id="selCopyBtn" class="sel-action-btn" title="Copy Text">
          <svg class="icon icon-xs" viewBox="0 0 24 24"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>COPY</span>
        </button>
      `;
      document.body.appendChild(bar);
      this.selectionToolbar = bar;
    }

    // 2. Floating Drawing Controls Dock
    if (!document.getElementById('drawingDock')) {
      const dock = document.createElement('div');
      dock.id = 'drawingDock';
      dock.className = 'drawing-dock';
      dock.innerHTML = `
        <div class="dock-handle">PEN BRUSH</div>
        <div class="dock-tool-group">
          <button id="brushModePenBtn" class="dock-btn active" title="Pen Stroke">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m18 2 4 4-14 14H4v-4L18 2z"/></svg>
          </button>
          <button id="brushModeEraserBtn" class="dock-btn" title="Stroke Eraser">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
          </button>
        </div>
        <div class="dock-divider"></div>
        <div class="dock-color-palette">
          <button class="dock-color-btn active" style="background:#f59e0b;" data-color="#f59e0b" title="Amber"></button>
          <button class="dock-color-btn" style="background:#10b981;" data-color="#10b981" title="Emerald"></button>
          <button class="dock-color-btn" style="background:#3b82f6;" data-color="#3b82f6" title="Blue"></button>
          <button class="dock-color-btn" style="background:#ef4444;" data-color="#ef4444" title="Red"></button>
          <button class="dock-color-btn" style="background:#e3e6e9; border:1px solid #888;" data-color="#e3e6e9" title="White/Light"></button>
        </div>
        <div class="dock-divider"></div>
        <div class="dock-width-group">
          <button class="dock-width-btn" data-width="2" title="Fine (2px)"><span style="width:3px; height:3px;"></span></button>
          <button class="dock-width-btn active" data-width="4" title="Medium (4px)"><span style="width:6px; height:6px;"></span></button>
          <button class="dock-width-btn" data-width="8" title="Thick (8px)"><span style="width:10px; height:10px;"></span></button>
        </div>
        <div class="dock-divider"></div>
        <div class="dock-actions">
          <button id="drawingUndoBtn" class="dock-btn btn-icon" title="Undo Stroke">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <button id="drawingClearBtn" class="dock-btn btn-icon" title="Clear Page Drawings">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button id="drawingDoneBtn" class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 8px;">DONE</button>
        </div>
      `;
      document.body.appendChild(dock);
    }

    // 3. Drawing Canvas Overlay Layer
    let canvas = document.getElementById('drawingCanvasOverlay');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'drawingCanvasOverlay';
      canvas.className = 'drawing-canvas-overlay';
      const frame = document.getElementById('readerFrame');
      if (frame) frame.appendChild(canvas);
    }
    this.drawingCanvas = canvas;
    this.drawingCtx = canvas.getContext('2d');
  },

  bindEvents() {
    // 1. Floating Selection Toolbar Events
    this.selectionToolbar.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = btn.getAttribute('data-color');
        this.applyHighlightToCurrentSelection(color);
      });
    });

    const selCopyBtn = document.getElementById('selCopyBtn');
    if (selCopyBtn) {
      selCopyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentSelectedText) {
          navigator.clipboard.writeText(this.currentSelectedText).catch(() => {});
        }
        this.hideSelectionToolbar();
      });
    }

    // Global click dismisses selection toolbar if clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.selectionToolbar && !this.selectionToolbar.contains(e.target)) {
        this.hideSelectionToolbar();
      }
    });

    window.addEventListener('resize', () => {
      this.hideSelectionToolbar();
      this.resizeDrawingCanvas();
    });

    // 2. Drawing Dock Tool Events
    const penBtn = document.getElementById('brushModePenBtn');
    const eraserBtn = document.getElementById('brushModeEraserBtn');
    if (penBtn && eraserBtn) {
      penBtn.addEventListener('click', () => {
        this.brushMode = 'pen';
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
        this.syncBrushSettings();
      });
      eraserBtn.addEventListener('click', () => {
        this.brushMode = 'eraser';
        eraserBtn.classList.add('active');
        penBtn.classList.remove('active');
        this.syncBrushSettings();
      });
    }

    document.querySelectorAll('.dock-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dock-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushColor = btn.getAttribute('data-color');
        this.syncBrushSettings();
      });
    });

    document.querySelectorAll('.dock-width-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dock-width-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushWidth = parseInt(btn.getAttribute('data-width'), 10) || 3;
        this.syncBrushSettings();
      });
    });

    const undoBtn = document.getElementById('drawingUndoBtn');
    if (undoBtn) undoBtn.addEventListener('click', () => this.undoDrawing());

    const clearBtn = document.getElementById('drawingClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearCurrentChapterDrawings());

    const doneBtn = document.getElementById('drawingDoneBtn');
    if (doneBtn) doneBtn.addEventListener('click', () => this.setToolMode('none'));

    // 3. Drawing Canvas Pointer Events
    this.setupDrawingCanvasEvents();

    // 4. Annotations Drawer Events
    this.bindDrawerEvents();
  },

  bindDrawerEvents() {
    const drawerBtn = document.getElementById('annotationsDrawerBtn');
    const drawer = document.getElementById('annotationsDrawer');
    const backdrop = document.getElementById('annotationsBackdrop');
    const closeBtn = document.getElementById('annotationsCloseBtn');

    if (drawerBtn) {
      drawerBtn.addEventListener('click', () => this.toggleDrawer(true));
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.toggleDrawer(false));
    }
    if (backdrop) {
      backdrop.addEventListener('click', () => this.toggleDrawer(false));
    }

    // Search filter
    const searchInput = document.getElementById('annotationsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderDrawerList(e.target.value.toLowerCase());
      });
    }

    // Tab filters
    document.querySelectorAll('.annot-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.annot-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-tab');
        this.renderDrawerList('', filter);
      });
    });

    // Export button
    const exportBtn = document.getElementById('annotationsExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAnnotationsAsMarkdown());
    }
  },

  toggleDrawer(open) {
    const drawer = document.getElementById('annotationsDrawer');
    const backdrop = document.getElementById('annotationsBackdrop');
    if (drawer) drawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
    if (open) {
      this.renderDrawerList();
    }
  },

  // -------------------------------------------------------------
  // Tool Modes: None, Highlight, Draw
  // -------------------------------------------------------------
  setToolMode(mode) {
    this.activeTool = mode;
    
    // Update toolbar button active states
    document.querySelectorAll('.annot-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === mode);
    });

    const drawingDock = document.getElementById('drawingDock');
    const canvasOverlay = this.drawingCanvas;

    if (mode === 'draw') {
      if (drawingDock) drawingDock.classList.add('open');
      if (canvasOverlay) {
        canvasOverlay.style.pointerEvents = 'auto';
        this.resizeDrawingCanvas();
      }
      // If PDF rendition has Fabric canvas
      if (State.currentRendition && typeof State.currentRendition.setIsDrawing === 'function') {
        State.currentRendition.setIsDrawing('yes');
        State.currentRendition.setBrushColor(this.brushColor);
        State.currentRendition.setBrushWidth(this.brushWidth);
      }
    } else {
      if (drawingDock) drawingDock.classList.remove('open');
      if (canvasOverlay) canvasOverlay.style.pointerEvents = 'none';
      if (State.currentRendition && typeof State.currentRendition.setIsDrawing === 'function') {
        State.currentRendition.setIsDrawing('no');
      }
    }

    const frame = document.getElementById('readerFrame');
    if (frame) {
      frame.classList.toggle('cursor-crosshair', mode === 'draw');
    }
  },

  syncBrushSettings() {
    if (State.currentRendition && typeof State.currentRendition.setBrushColor === 'function') {
      State.currentRendition.setBrushColor(this.brushMode === 'eraser' ? '#ffffff' : this.brushColor);
      State.currentRendition.setBrushWidth(this.brushWidth);
    }
  },

  // -------------------------------------------------------------
  // Book Lifecycle & Persistence
  // -------------------------------------------------------------
  async loadForBook(fileId) {
    if (!fileId) return;
    this.items = [];
    
    // 1. Read from local storage first (instant response)
    const localKey = `eonz.annotations.${fileId}`;
    const localData = localStorage.getItem(localKey);
    if (localData) {
      try {
        this.items = JSON.parse(localData) || [];
      } catch (e) {
        this.items = [];
      }
    }

    // 2. Fetch from server API in background and reconcile
    try {
      if (window.API && typeof window.API.getAnnotations === 'function') {
        const serverList = await API.getAnnotations(fileId);
        if (Array.isArray(serverList) && serverList.length >= this.items.length) {
          this.items = serverList;
          localStorage.setItem(localKey, JSON.stringify(this.items));
        }
      }
    } catch (err) {
      console.warn('Could not sync server annotations:', err.message);
    }

    this.renderAllForCurrentPage();
    this.updateBadgeCounts();
  },

  saveToStorage() {
    if (!State.currentBook) return;
    const fileId = State.currentBook.fileId;
    const localKey = `eonz.annotations.${fileId}`;
    localStorage.setItem(localKey, JSON.stringify(this.items));
    
    // Sync to backend debounced
    if (window.API && typeof window.API.saveAnnotations === 'function') {
      API.saveAnnotations(fileId, this.items).catch(err => {
        console.warn('Background annotation save error:', err.message);
      });
    }

    this.updateBadgeCounts();
  },

  updateBadgeCounts() {
    const badge = document.getElementById('annotationsCountBadge');
    if (badge) {
      const count = this.items.length;
      badge.textContent = count > 0 ? String(count) : '';
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  },

  onPageChanged(chapterDocIndex) {
    this.currentChapterDocIndex = parseInt(chapterDocIndex, 10) || 0;
    this.hideSelectionToolbar();
    this.renderAllForCurrentPage();
  },

  renderAllForCurrentPage() {
    this.renderHighlights();
    this.renderDrawings();
  },

  // -------------------------------------------------------------
  // Highlighting Engine (Reflowable + PDF)
  // -------------------------------------------------------------
  getHighlightStyleCss(colorCode) {
    switch (colorCode) {
      case 'color-0':
        return 'background-color: rgba(254, 240, 138, 0.45) !important; color: inherit !important; border-radius: 2px;';
      case 'color-1':
        return 'background-color: rgba(187, 247, 208, 0.45) !important; color: inherit !important; border-radius: 2px;';
      case 'color-2':
        return 'background-color: rgba(153, 246, 228, 0.45) !important; color: inherit !important; border-radius: 2px;';
      case 'color-3':
        return 'background-color: rgba(186, 230, 253, 0.45) !important; color: inherit !important; border-radius: 2px;';
      case 'line-0':
        return 'border-bottom: 2.5px solid #ef4444 !important; background-color: transparent !important;';
      default:
        if (colorCode && (colorCode.startsWith('#') || colorCode.startsWith('rgb'))) {
          return `background-color: ${colorCode} !important; color: inherit !important; border-radius: 2px;`;
        }
        return 'background-color: rgba(254, 240, 138, 0.45) !important; color: inherit !important; border-radius: 2px;';
    }
  },

  attachSelectionListeners(doc, iframe) {
    if (!doc || doc.__annotEventsAttached) return;
    doc.__annotEventsAttached = true;

    // Detect when text is deselected / unblocked
    doc.addEventListener('selectionchange', () => {
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        this.hideSelectionToolbar();
      }
    });

    doc.addEventListener('mousedown', (e) => {
      // If clicking inside the document, check if selection is empty and hide toolbar
      const sel = doc.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        this.hideSelectionToolbar();
      }
    });

    const handleSelectionEnd = (e) => {
      if (this.activeTool === 'draw') return;
      const selection = doc.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        this.hideSelectionToolbar();
        return;
      }

      const selectedText = selection.toString().trim();
      if (selectedText.length === 0) {
        this.hideSelectionToolbar();
        return;
      }

      let rect = null;
      try {
        const range = selection.getRangeAt(0);
        rect = range.getBoundingClientRect();
      } catch (err) {
        return;
      }

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        this.hideSelectionToolbar();
        return;
      }

      const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
      const absLeft = iframeRect.left + rect.left + rect.width / 2;
      const absTop = iframeRect.top + rect.top - 10;

      this.currentSelectedText = selectedText;
      this.currentSelectionRange = selection.getRangeAt(0);
      this.currentSelectionRect = { left: absLeft, top: absTop, height: rect.height };

      this.showSelectionToolbar(absLeft, absTop);
    };

    doc.addEventListener('mouseup', handleSelectionEnd);
    doc.addEventListener('keyup', handleSelectionEnd);
    doc.addEventListener('touchend', handleSelectionEnd);
  },

  showSelectionToolbar(centerX, topY) {
    if (!this.selectionToolbar) return;
    this.selectionToolbar.style.display = 'flex';
    
    requestAnimationFrame(() => {
      const tbWidth = this.selectionToolbar.offsetWidth || 180;
      const tbHeight = this.selectionToolbar.offsetHeight || 38;
      
      let left = centerX - tbWidth / 2;
      let top = topY - tbHeight - 6;

      if (left < 10) left = 10;
      if (left + tbWidth > window.innerWidth - 10) left = window.innerWidth - tbWidth - 10;
      if (top < 10) top = topY + (this.currentSelectionRect?.height || 20) + 8;

      this.selectionToolbar.style.left = `${left}px`;
      this.selectionToolbar.style.top = `${top}px`;
    });
  },

  hideSelectionToolbar() {
    if (this.selectionToolbar) {
      this.selectionToolbar.style.display = 'none';
    }
  },

  async applyHighlightToCurrentSelection(colorCode) {
    if (!State.currentBook || !State.currentRendition) return;
    this.hideSelectionToolbar();

    const rendition = State.currentRendition;
    const isPdf = State.currentBook.format === 'PDF';
    const noteKey = 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    let rangeData = null;
    try {
      if (isPdf && typeof rendition.getHightlightCoords === 'function') {
        rangeData = await rendition.getHightlightCoords(this.currentChapterDocIndex);
      } else if (typeof rendition.getHightlightCoords === 'function') {
        rangeData = await rendition.getHightlightCoords();
      }
    } catch (e) {
      console.warn('Failed to retrieve highlight coordinates:', e);
    }

    if (!rangeData) {
      return;
    }

    const annotation = {
      id: noteKey,
      fileId: State.currentBook.fileId,
      type: 'highlight',
      color: colorCode || 'color-0',
      range: JSON.stringify(rangeData),
      selectedText: this.currentSelectedText,
      chapterDocIndex: this.currentChapterDocIndex,
      format: State.currentBook.format,
      createdAt: Date.now()
    };

    this.items.push(annotation);
    this.saveToStorage();

    // Render immediately into the active document
    this.renderHighlights();
  },

  renderHighlights() {
    if (!State.currentRendition) return;
    const rendition = State.currentRendition;
    const isPdf = State.currentBook && State.currentBook.format === 'PDF';
    
    const highlights = isPdf
      ? this.items.filter(i => i.type === 'highlight')
      : this.items.filter(i => i.type === 'highlight' && (i.chapterDocIndex === undefined || i.chapterDocIndex === this.currentChapterDocIndex));

    const handleNoteClick = (e) => {
      // Highlight clicked
    };

    try {
      if (typeof rendition.renderHighlighters === 'function') {
        const payload = highlights.map(h => ({
          key: h.id,
          color: h.color,
          range: h.range,
          notes: '',
          chapterIndex: h.chapterDocIndex
        }));
        rendition.renderHighlighters(payload, handleNoteClick);
      }
    } catch (e) {
      console.warn('Error applying highlights to rendition:', e);
    }

    this.enforceHighlightStyles();
    setTimeout(() => this.enforceHighlightStyles(), 60);
    setTimeout(() => this.enforceHighlightStyles(), 200);
  },

  getPdfHighlightBg(colorCode) {
    switch (colorCode) {
      case 'color-0':
        return '#fef08a'; // Yellow
      case 'color-1':
        return '#bbf7d0'; // Sage / Green
      case 'color-2':
        return '#99f6e4'; // Mint
      case 'color-3':
        return '#bae6fd'; // Sky Blue
      case 'line-0':
        return '#ef4444'; // Red
      default:
        if (colorCode && (colorCode.startsWith('#') || colorCode.startsWith('rgb'))) {
          return colorCode;
        }
        return '#fef08a';
    }
  },

  enforceHighlightStyles() {
    if (!State.currentRendition) return;
    const rendition = State.currentRendition;
    const isPdf = State.currentBook && State.currentBook.format === 'PDF';
    const docs = [];

    if (typeof rendition.getDocument === 'function') {
      const d = rendition.getDocument();
      if (d) docs.push(d);
    }
    if (typeof rendition.getAllDocuments === 'function') {
      const allDocs = rendition.getAllDocuments();
      if (Array.isArray(allDocs)) {
        allDocs.forEach(d => { if (d && !docs.includes(d)) docs.push(d); });
      }
    }

    docs.forEach(doc => {
      if (!doc || !doc.querySelectorAll) return;
      const elements = doc.querySelectorAll('.kookit-note');
      elements.forEach(el => {
        const key = el.getAttribute('data-key');
        const item = this.items.find(i => i.id === key);
        if (item) {
          el.classList.add(item.color);
          if (!isPdf) {
            el.style.cssText = this.getHighlightStyleCss(item.color);
          } else {
            // For PDF overlay divs, preserve coordinates and only ensure vivid background color and blend mode
            const bg = this.getPdfHighlightBg(item.color);
            el.style.backgroundColor = bg;
            el.style.mixBlendMode = 'multiply';
            el.style.opacity = '0.45';
            el.style.zIndex = '2';
            el.style.pointerEvents = 'auto';
          }
        }
      });
    });
  },

  // -------------------------------------------------------------
  // Free Draw Brush Engine
  // -------------------------------------------------------------
  resizeDrawingCanvas() {
    if (!this.drawingCanvas) return;
    const frame = document.getElementById('readerFrame');
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.drawingCanvas.width = rect.width * dpr;
    this.drawingCanvas.height = rect.height * dpr;
    this.drawingCanvas.style.width = `${rect.width}px`;
    this.drawingCanvas.style.height = `${rect.height}px`;

    this.drawingCtx = this.drawingCanvas.getContext('2d');
    this.drawingCtx.scale(dpr, dpr);
    this.redrawOverlayStrokes();
  },

  setupDrawingCanvasEvents() {
    const canvas = this.drawingCanvas;
    if (!canvas) return;

    let isDrawing = false;
    let points = [];

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        xRatio: (clientX - rect.left) / rect.width,
        yRatio: (clientY - rect.top) / rect.height
      };
    };

    const startDraw = (e) => {
      if (this.activeTool !== 'draw') return;
      e.preventDefault();
      isDrawing = true;
      const p = getPos(e);
      points = [p];

      this.drawingCtx.beginPath();
      this.drawingCtx.moveTo(p.x, p.y);
      this.drawingCtx.lineCap = 'round';
      this.drawingCtx.lineJoin = 'round';
      this.drawingCtx.strokeStyle = this.brushMode === 'eraser' ? 'rgba(0,0,0,1)' : this.brushColor;
      this.drawingCtx.lineWidth = this.brushWidth;
      this.drawingCtx.globalCompositeOperation = this.brushMode === 'eraser' ? 'destination-out' : 'source-over';
    };

    const drawMove = (e) => {
      if (!isDrawing || this.activeTool !== 'draw') return;
      e.preventDefault();
      const p = getPos(e);
      points.push(p);

      if (points.length > 2) {
        const xc = (points[points.length - 1].x + points[points.length - 2].x) / 2;
        const yc = (points[points.length - 1].y + points[points.length - 2].y) / 2;
        this.drawingCtx.quadraticCurveTo(points[points.length - 2].x, points[points.length - 2].y, xc, yc);
        this.drawingCtx.stroke();
      }
    };

    const endDraw = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      if (points.length < 2) return;

      const pathData = {
        color: this.brushColor,
        width: this.brushWidth,
        isEraser: this.brushMode === 'eraser',
        points: points.map(pt => ({ xRatio: pt.xRatio, yRatio: pt.yRatio }))
      };

      this.saveDrawingStroke(pathData);
      points = [];
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', drawMove);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', drawMove, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
  },

  saveDrawingStroke(pathData) {
    if (!State.currentBook) return;
    
    let drawingAnnot = this.items.find(
      i => i.type === 'drawing' && i.chapterDocIndex === this.currentChapterDocIndex
    );

    if (!drawingAnnot) {
      drawingAnnot = {
        id: 'draw_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        fileId: State.currentBook.fileId,
        type: 'drawing',
        chapterDocIndex: this.currentChapterDocIndex,
        format: State.currentBook.format,
        strokes: [],
        createdAt: Date.now()
      };
      this.items.push(drawingAnnot);
    }

    drawingAnnot.strokes.push(pathData);
    drawingAnnot.updatedAt = Date.now();
    this.saveToStorage();
  },

  undoDrawing() {
    // If PDF fabric drawing
    if (State.currentRendition && typeof State.currentRendition.undoFabric === 'function') {
      State.currentRendition.undoFabric(this.currentChapterDocIndex);
      return;
    }

    const drawingAnnot = this.items.find(
      i => i.type === 'drawing' && i.chapterDocIndex === this.currentChapterDocIndex
    );
    if (drawingAnnot && drawingAnnot.strokes && drawingAnnot.strokes.length > 0) {
      drawingAnnot.strokes.pop();
      this.saveToStorage();
      this.redrawOverlayStrokes();
    }
  },

  clearCurrentChapterDrawings() {
    // If PDF fabric drawing
    if (State.currentRendition && typeof State.currentRendition.clearFabric === 'function') {
      State.currentRendition.clearFabric(this.currentChapterDocIndex);
    }

    const index = this.items.findIndex(
      i => i.type === 'drawing' && i.chapterDocIndex === this.currentChapterDocIndex
    );
    if (index >= 0) {
      this.items.splice(index, 1);
      this.saveToStorage();
      this.redrawOverlayStrokes();
    }
  },

  renderDrawings() {
    // If PDF format, Kookit handles Fabric canvas restore
    if (State.currentBook && State.currentBook.format === 'PDF') {
      const pdfDrawing = this.items.find(
        i => i.type === 'drawing' && i.chapterDocIndex === this.currentChapterDocIndex
      );
      if (pdfDrawing && State.currentRendition && typeof State.currentRendition.restoreAnnotation === 'function') {
        State.currentRendition.restoreAnnotation(this.currentChapterDocIndex, pdfDrawing.data);
      }
    }
    this.redrawOverlayStrokes();
  },

  redrawOverlayStrokes() {
    if (!this.drawingCanvas || !this.drawingCtx) return;
    const rect = this.drawingCanvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.drawingCtx.clearRect(0, 0, w, h);

    const drawingAnnot = this.items.find(
      i => i.type === 'drawing' && i.chapterDocIndex === this.currentChapterDocIndex
    );
    if (!drawingAnnot || !drawingAnnot.strokes) return;

    drawingAnnot.strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length < 2) return;
      this.drawingCtx.beginPath();
      this.drawingCtx.lineCap = 'round';
      this.drawingCtx.lineJoin = 'round';
      this.drawingCtx.strokeStyle = stroke.color || '#f59e0b';
      this.drawingCtx.lineWidth = stroke.width || 3;
      this.drawingCtx.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';

      const first = stroke.points[0];
      this.drawingCtx.moveTo(first.xRatio * w, first.yRatio * h);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        this.drawingCtx.lineTo(pt.xRatio * w, pt.yRatio * h);
      }
      this.drawingCtx.stroke();
    });
  },

  deleteAnnotation(id) {
    const index = this.items.findIndex(i => i.id === id);
    if (index >= 0) {
      this.items.splice(index, 1);
      this.saveToStorage();
      this.renderAllForCurrentPage();
      this.renderDrawerList();
      
      // Delete on server
      if (State.currentBook && window.API && typeof window.API.deleteAnnotation === 'function') {
        API.deleteAnnotation(State.currentBook.fileId, id).catch(() => {});
      }
    }
  },

  // -------------------------------------------------------------
  // Annotations Side Drawer & Export
  // -------------------------------------------------------------
  renderDrawerList(searchQuery = '', filterType = 'all') {
    const listEl = document.getElementById('annotationsList');
    if (!listEl) return;

    let filtered = this.items.slice();
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter(i => i.type === filterType);
    }
    if (searchQuery) {
      filtered = filtered.filter(i => {
        const text = (i.selectedText || '') + ' ' + (i.content || '');
        return text.toLowerCase().includes(searchQuery);
      });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-annotations-placeholder">
          <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div style="font-size:13px; font-weight:600; margin-top:8px;">NO ANNOTATIONS FOUND</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Highlight text or draw on pages to index them here.</div>
        </div>
      `;
      return;
    }

    // Sort newest first
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    listEl.innerHTML = filtered.map(item => {
      let icon = '●';
      let title = 'ANNOTATION';
      let bodyText = '';
      let badgeClass = 'badge-epub';

      if (item.type === 'highlight') {
        icon = '✎';
        title = `HIGHLIGHT (SEC ${item.chapterDocIndex + 1})`;
        badgeClass = 'badge-pdf';
        bodyText = item.selectedText ? `"${escapeHtml(item.selectedText)}"` : 'Marked text';
      } else if (item.type === 'drawing') {
        icon = '🖌';
        title = `DRAWING (SEC ${item.chapterDocIndex + 1})`;
        badgeClass = 'badge-txt';
        bodyText = `${(item.strokes || []).length} stroke(s) on page`;
      }

      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';

      return `
        <div class="annotation-item" data-id="${item.id}" onclick="Annotations.jumpToAnnotation('${item.id}', ${item.chapterDocIndex})">
          <div class="annot-item-header">
            <span class="badge ${badgeClass}">${icon} ${title}</span>
            <span class="annot-item-date">${dateStr}</span>
          </div>
          <div class="annot-item-body">${bodyText}</div>
          <div class="annot-item-actions" onclick="event.stopPropagation();">
            <button class="btn btn-ghost btn-xs btn-icon" onclick="Annotations.jumpToAnnotation('${item.id}', ${item.chapterDocIndex})" title="Jump to location">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button class="btn btn-ghost btn-xs btn-icon text-danger" onclick="Annotations.deleteAnnotation('${item.id}')" title="Delete">
              <svg class="icon icon-xs" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  jumpToAnnotation(id, chapterDocIndex) {
    this.toggleDrawer(false);
    if (State.currentRendition) {
      if (typeof State.currentRendition.goToChapterDocIndex === 'function') {
        State.currentRendition.goToChapterDocIndex(chapterDocIndex);
      } else if (typeof State.currentRendition.goToChapter === 'function') {
        State.currentRendition.goToChapter(chapterDocIndex);
      }
    }
  },

  exportAnnotationsAsMarkdown() {
    if (!State.currentBook || this.items.length === 0) {
      return;
    }

    const title = State.currentBook.name || 'Document';
    const lines = [
      `# Annotations & Reading Log: ${title}`,
      `*Generated from EonzArchive on ${new Date().toLocaleString()}*`,
      `Total Annotations: ${this.items.length}`,
      '',
      '---',
      ''
    ];

    this.items.forEach((item, idx) => {
      const date = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
      lines.push(`### ${idx + 1}. [Section ${item.chapterDocIndex + 1}] - ${item.type.toUpperCase()}`);
      lines.push(`*Recorded: ${date}*`);
      lines.push('');

      if (item.type === 'highlight') {
        lines.push(`> ${item.selectedText}`);
        lines.push('');
      } else if (item.type === 'drawing') {
        lines.push(`*Freehand pen drawings recorded on section canvas.*`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_annotations.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

window.Annotations = Annotations;
