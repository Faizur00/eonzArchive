/**
 * EonzArchive - Library View & Controller Module (Swiss Minimalist)
 */

const Library = {
  async init() {
    this.bindEvents();
    await this.refreshStatus();
    await this.loadFolder(State.currentFolderId);
  },

  bindEvents() {
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        State.sortBy = e.target.value;
        this.loadFolder(State.currentFolderId);
      });
    }

    // Format Filter Pills
    document.querySelectorAll('.pill-btn[data-format]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.pill-btn[data-format]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.formatFilter = btn.getAttribute('data-format');
        this.loadFolder(State.currentFolderId);
      });
    });

    // Cached only toggle
    const cachedToggle = document.getElementById('cachedOnlyToggle');
    if (cachedToggle) {
      cachedToggle.addEventListener('click', () => {
        State.cachedOnly = !State.cachedOnly;
        cachedToggle.classList.toggle('active', State.cachedOnly);
        this.loadFolder(State.currentFolderId);
      });
    }

    // View Mode toggles
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');
    if (gridBtn && listBtn) {
      gridBtn.addEventListener('click', () => {
        State.setViewMode('grid');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        this.renderBooks();
      });
      listBtn.addEventListener('click', () => {
        State.setViewMode('list');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        this.renderBooks();
      });
    }
  },

  async refreshStatus() {
    try {
      const status = await API.getStatus();
      const drivePill = document.getElementById('driveStatusPill');
      const rootFolderEl = document.getElementById('rootFolderMeta');
      
      if (drivePill) {
        if (status.connected) {
          drivePill.innerHTML = `<span class="status-dot"></span> CONNECTED`;
          drivePill.className = 'status-pill cached';
        } else {
          drivePill.innerHTML = `<span class="status-dot"></span> OFFLINE`;
          drivePill.className = 'status-pill';
        }
      }

      if (rootFolderEl && status.rootFolder) {
        rootFolderEl.textContent = status.rootFolder.name || 'INDEX';
      }
    } catch (err) {
      console.warn('Status refresh failed:', err);
    }
  },

  async loadFolder(folderId = null) {
    const listContainer = document.getElementById('booksContainer');
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="empty-state" style="border:none; padding: 40px 0;">
          <div class="spinner" style="margin: 0 auto 12px;"></div>
          <p>RETRIEVING ARCHIVE RECORDS...</p>
        </div>`;
    }

    try {
      const res = await API.getFiles({
        folderId: folderId,
        format: State.formatFilter,
        cachedOnly: State.cachedOnly,
        sort: State.sortBy
      });

      State.currentFolderId = res.currentFolder?.id;
      State.breadcrumbs = res.breadcrumbs || [];
      State.folders = res.folders || [];
      State.books = res.books || [];

      this.renderBreadcrumbs();
      this.renderFolders();
      this.renderBooks();
    } catch (err) {
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <h3>ERROR LOADING ARCHIVE</h3>
            <p>${err.message}</p>
            <button class="btn btn-primary btn-sm" onclick="Library.loadFolder(null)" style="margin-top: 12px;">RETURN TO ROOT</button>
          </div>`;
      }
    }
  },

  renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbsTrail');
    const backBtn = document.getElementById('breadcrumbBackBtn');
    if (!container) return;

    if (backBtn) {
      backBtn.style.display = (State.breadcrumbs.length >= 2) ? 'inline-flex' : 'none';
    }

    if (!State.breadcrumbs || State.breadcrumbs.length === 0) {
      container.innerHTML = `<span class="breadcrumb-item active">ROOT ARCHIVE</span>`;
      return;
    }

    container.innerHTML = State.breadcrumbs.map((crumb, idx) => {
      const isLast = idx === State.breadcrumbs.length - 1;
      if (isLast) {
        return `<span class="breadcrumb-item active">${escapeHtml(crumb.name.toUpperCase())}</span>`;
      }
      return `
        <a class="breadcrumb-item" onclick="Library.loadFolder('${crumb.id}')">${escapeHtml(crumb.name.toUpperCase())}</a>
        <span class="breadcrumb-sep">/</span>`;
    }).join('');
  },

  goBack() {
    if (State.breadcrumbs.length < 2) return;
    const parent = State.breadcrumbs[State.breadcrumbs.length - 2];
    this.loadFolder(parent ? parent.id : null);
  },

  renderFolders() {
    const grid = document.getElementById('foldersGrid');
    if (!grid) return;

    if (State.folders.length === 0) {
      grid.style.display = 'none';
      grid.innerHTML = '';
      return;
    }

    grid.style.display = 'grid';
    grid.innerHTML = State.folders.map(f => `
      <div class="folder-card" onclick="Library.loadFolder('${f.id}')" title="${escapeHtml(f.name)}">
        <span class="folder-icon">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
        </span>
        <span class="folder-name">${escapeHtml(f.name)}</span>
      </div>
    `).join('');
  },

  renderBooks() {
    const container = document.getElementById('booksContainer');
    if (!container) return;

    if (State.books.length === 0) {
      container.innerHTML = '';
      return;
    }

    if (State.viewMode === 'list') {
      this.renderTableView(container);
    } else {
      this.renderGridView(container);
    }
  },

  renderGridView(container) {
    container.innerHTML = `
      <div class="books-grid">
        ${State.books.map((b) => {
          const fmt = (b.format || 'EPUB').toLowerCase();
          const cleanTitle = escapeHtml(b.name || 'Untitled Record');
          return `
            <div class="book-card" data-book-id="${b.id}">
              <div class="book-cover">
                <div class="cover-header">
                  <span class="badge badge-${fmt}">${b.format}</span>
                  <span class="status-pill ${b.cached ? 'cached' : ''}">
                    <span class="status-dot"></span> ${b.cached ? 'CACHED' : 'CLOUD'}
                  </span>
                </div>
                <div class="cover-title-area">
                  <div class="cover-book-title" title="${cleanTitle}">${cleanTitle}</div>
                </div>
              </div>
              <div class="book-card-body">
                <div class="book-meta-row">
                  <span>SIZE: ${b.sizeFormatted || '0 B'}</span>
                  <span>${b.cached ? `LOCAL: ${b.cachedSizeFormatted}` : 'REMOTE'}</span>
                </div>
                <div class="book-actions-row">
                  <button class="btn btn-primary btn-sm" style="flex-grow: 1;" onclick="Reader.openBook('${b.id}', '${escapeQuotes(b.name)}', '${b.format}')">
                    READ
                  </button>
                  ${b.cached ? `
                    <button class="btn btn-ghost btn-sm btn-icon" title="Delete cached file" onclick="Library.deleteCache('${b.id}')">
                      <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  ` : `
                    <button class="btn btn-secondary btn-sm btn-icon" title="Cache locally" onclick="Library.cacheBook('${b.id}')">
                      <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  `}
                  ${b.webViewLink ? `
                    <a href="${b.webViewLink}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-icon" title="Open in Google Drive">
                      <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTableView(container) {
    container.innerHTML = `
      <div class="books-table-wrap">
        <table class="books-table">
          <thead>
            <tr>
              <th>DOCUMENT TITLE</th>
              <th>FORMAT</th>
              <th>SIZE</th>
              <th>STATUS</th>
              <th style="text-align: right;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${State.books.map(b => {
              const fmt = (b.format || 'EPUB').toLowerCase();
              return `
                <tr>
                  <td>
                    <div class="table-book-title">
                      <span>${escapeHtml(b.name)}</span>
                    </div>
                  </td>
                  <td><span class="badge badge-${fmt}">${b.format}</span></td>
                  <td style="font-family: var(--font-mono);">${b.sizeFormatted || '0 B'}</td>
                  <td>
                    <span class="status-pill ${b.cached ? 'cached' : ''}">
                      <span class="status-dot"></span> ${b.cached ? 'CACHED' : 'CLOUD'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-primary btn-sm" onclick="Reader.openBook('${b.id}', '${escapeQuotes(b.name)}', '${b.format}')">
                      READ
                    </button>
                    ${b.cached ? `
                      <button class="btn btn-ghost btn-sm" onclick="Library.deleteCache('${b.id}')">PURGE</button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="Library.cacheBook('${b.id}')">CACHE</button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async triggerSync() {
    const btn = document.getElementById('syncBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="spinner spinner-sm"></div> SYNCING...`;
    }
    showToast('Sync Started', 'Synchronizing with archive repository...', 'info');

    try {
      const res = await API.triggerSync();
      showToast('Sync Complete', `Indexed ${res.stats?.totalBooks || 0} documents.`, 'success');
      await this.refreshStatus();
      await this.loadFolder(State.currentFolderId);
    } catch (err) {
      showToast('Sync Failed', err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> SYNC`;
      }
    }
  },

  async cacheBook(fileId) {
    showToast('Caching Record', 'Downloading document to local archive...', 'info');
    try {
      await API.cacheBook(fileId);
      showToast('Cache Complete', 'Document cached locally.', 'success');
      await this.refreshStatus();
      await this.loadFolder(State.currentFolderId);
    } catch (err) {
      showToast('Cache Failed', err.message, 'danger');
    }
  },

  async deleteCache(fileId) {
    try {
      await API.deleteBookCache(fileId);
      showToast('Cache Purged', 'Local copy removed.', 'info');
      await this.refreshStatus();
      await this.loadFolder(State.currentFolderId);
    } catch (err) {
      showToast('Error', err.message, 'danger');
    }
  }
};

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.Library = Library;
