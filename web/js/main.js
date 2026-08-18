/**
 * EonzArchive - Main Entrypoint & Global UI Controls
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Themes
  State.setTheme(State.theme);

  // Setup Theme Toggle Button
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = State.theme === 'dark' ? 'light' : 'dark';
      State.setTheme(nextTheme);
      updateThemeToggleIcon();
    });
    updateThemeToggleIcon();
  }

  // Setup Storage & Cache Modal
  setupStorageModal();

  // Setup Keyboard Shortcuts Modal
  setupShortcutsModal();

  // Initialize Library, Reader & Router
  await Library.init();
  Reader.init();
  Router.init();
});

function updateThemeToggleIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  if (State.theme === 'dark') {
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    btn.setAttribute('title', 'Switch to Light Theme');
  } else {
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    btn.setAttribute('title', 'Switch to Dark Theme');
  }
}

function setupStorageModal() {
  const modal = document.getElementById('storageModal');
  const openBtn = document.getElementById('storageManagerBtn');
  const closeBtn = document.getElementById('storageModalCloseBtn');
  const clearCacheBtn = document.getElementById('modalClearCacheBtn');

  if (openBtn && modal) {
    openBtn.addEventListener('click', async () => {
      modal.classList.add('open');
      await refreshStorageModalData();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear all cached books from disk? Cloud files will remain intact.')) return;
      try {
        clearCacheBtn.disabled = true;
        clearCacheBtn.textContent = 'Clearing...';
        await API.clearAllCache();
        showToast('Cache Purged', 'All local cached books removed.', 'info');
        await refreshStorageModalData();
        await Library.refreshStatus();
        await Library.loadFolder(State.currentFolderId);
      } catch (err) {
        showToast('Error', err.message, 'danger');
      } finally {
        clearCacheBtn.disabled = false;
        clearCacheBtn.textContent = 'Purge All Local Cache';
      }
    });
  }
}

async function refreshStorageModalData() {
  const body = document.getElementById('storageModalBody');
  if (!body) return;

  try {
    const status = await API.getStatus();
    const stats = status.cacheStats;
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:var(--bg-surface-subtle); padding:16px; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div style="font-size:12px; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Local Disk Usage</div>
          <div style="font-size:24px; font-weight:700; color:var(--text-primary); margin:4px 0 8px;">${stats.totalBytesFormatted}</div>
          <div style="font-size:13px; color:var(--text-secondary);">${stats.count} books cached on local storage</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
            <span style="color:var(--text-muted);">Root Archive Folder</span>
            <span style="font-weight:600; color:var(--text-primary);">${status.rootFolder?.name || 'Archive'} (${status.rootFolder?.id || 'N/A'})</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
            <span style="color:var(--text-muted);">Total Cloud Index</span>
            <span style="font-weight:600; color:var(--text-primary);">${status.stats?.totalBooks || 0} books (${status.stats?.totalFolders || 0} folders)</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-subtle);">
            <span style="color:var(--text-muted);">Last Full Sync</span>
            <span style="font-weight:600; color:var(--text-primary);">${status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Never'}</span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<p style="color:var(--color-danger)">Failed to load storage details: ${err.message}</p>`;
  }
}

function setupShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  const openBtn = document.getElementById('shortcutsBtn');
  const closeBtn = document.getElementById('shortcutsModalCloseBtn');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => modal.classList.add('open'));
  }
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // Hotkey '?' to open shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '?' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      if (modal) modal.classList.toggle('open');
    }
  });
}

// Global Toast Alert Helper
function showToast(title, desc = '', type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="icon icon-sm" style="color:var(--color-success);" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`;
  } else if (type === 'danger') {
    iconSvg = `<svg class="icon icon-sm" style="color:var(--color-danger);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else {
    iconSvg = `<svg class="icon icon-sm" style="color:var(--brand-primary);" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${desc ? `<div class="toast-desc">${escapeHtml(desc)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

window.showToast = showToast;
