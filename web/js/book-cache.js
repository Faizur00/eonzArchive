/**
 * EonzArchive - Browser IndexedDB Book Binary Cache Module
 *
 * Persists downloaded ebook ArrayBuffers in IndexedDB to eliminate duplicate
 * Google Drive streaming downloads across page reloads and tab restorations.
 */

const BookCache = {
  DB_NAME: 'eonzArchiveCache',
  DB_VERSION: 1,
  STORE_NAME: 'books',
  MAX_BUDGET_BYTES: 250 * 1024 * 1024, // 250 MiB default budget

  _db: null,
  _dbPromise: null,

  /**
   * Check if IndexedDB is supported in the current environment
   */
  isSupported() {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  },

  /**
   * Open or retrieve the cached IndexedDB connection
   */
  open() {
    if (!this.isSupported()) return Promise.resolve(null);
    if (this._db) return Promise.resolve(this._db);
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'fileId' });
            store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
            store.createIndex('cachedAt', 'cachedAt', { unique: false });
          }
        };

        req.onsuccess = () => {
          this._db = req.result;
          this._db.onversionchange = () => {
            if (this._db) {
              this._db.close();
              this._db = null;
            }
            this._dbPromise = null;
          };
          resolve(this._db);
        };

        req.onerror = () => {
          console.warn('[BookCache] Failed to open IndexedDB:', req.error);
          this._dbPromise = null;
          resolve(null);
        };

        req.onblocked = () => {
          console.warn('[BookCache] IndexedDB open blocked by other connection.');
        };
      } catch (err) {
        console.warn('[BookCache] Exception while opening IndexedDB:', err);
        this._dbPromise = null;
        resolve(null);
      }
    });

    return this._dbPromise;
  },

  /**
   * Generate a version fingerprint from book metadata
   * Priority: md5Checksum > modifiedTime + size > null
   */
  getFingerprint(metadata) {
    if (!metadata || typeof metadata !== 'object') return null;
    if (metadata.md5Checksum && typeof metadata.md5Checksum === 'string') {
      return metadata.md5Checksum;
    }
    if (metadata.modifiedTime && (metadata.size !== undefined && metadata.size !== null)) {
      return `${metadata.modifiedTime}_${metadata.size}`;
    }
    return null;
  },

  /**
   * Retrieve cached book record if it matches the expected fingerprint
   */
  async get(fileId, expectedFingerprint = null) {
    if (!fileId) return null;
    try {
      const db = await this.open();
      if (!db) return null;

      const record = await new Promise((resolve) => {
        const tx = db.transaction([this.STORE_NAME], 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.get(fileId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });

      if (!record || !record.buffer) return null;

      // Validate fingerprint if one is provided
      if (expectedFingerprint) {
        if (record.fingerprint !== expectedFingerprint) {
          console.info(`[BookCache] Fingerprint mismatch for "${fileId}". Stale cache invalidated.`);
          this.delete(fileId).catch(() => {});
          return null;
        }
      }

      // Update last accessed time (best-effort)
      this.touch(fileId).catch(() => {});

      return record;
    } catch (err) {
      console.warn(`[BookCache] Failed to read cached book "${fileId}":`, err);
      return null;
    }
  },

  /**
   * Store a book record and ArrayBuffer into IndexedDB with LRU capacity checking
   */
  async put(record) {
    if (!record || !record.fileId || !record.buffer) return false;
    const sizeBytes = record.sizeBytes || record.buffer.byteLength || 0;

    // Skip persistence if a single document exceeds the configured budget
    if (sizeBytes > this.MAX_BUDGET_BYTES) {
      console.warn(`[BookCache] Book "${record.fileId}" (${sizeBytes} B) exceeds max budget. Skipping disk cache.`);
      return false;
    }

    try {
      const db = await this.open();
      if (!db) return false;

      // Ensure room in cache according to LRU policy
      await this.evictIfNeeded(sizeBytes);

      const now = Date.now();
      const entry = {
        fileId: record.fileId,
        fingerprint: record.fingerprint || null,
        buffer: record.buffer,
        sizeBytes: sizeBytes,
        cachedAt: record.cachedAt || now,
        lastAccessedAt: now,
        name: record.name || 'Untitled Document',
        format: (record.format || 'EPUB').toUpperCase()
      };

      const written = await this._writeEntry(db, entry);
      if (written) return true;

      // If write failed (e.g. QuotaExceededError), try evicting oldest entries and retry once
      console.warn('[BookCache] Cache write failed; attempting eviction retry...');
      await this.evictOldest(Math.max(sizeBytes, 30 * 1024 * 1024));
      return await this._writeEntry(db, entry);
    } catch (err) {
      console.warn(`[BookCache] Failed to store book "${record.fileId}":`, err);
      return false;
    }
  },

  /**
   * Low-level helper to write record inside a readwrite transaction
   */
  _writeEntry(db, entry) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([this.STORE_NAME], 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.warn('[BookCache] Put request error:', req.error);
          resolve(false);
        };
        tx.onabort = () => resolve(false);
      } catch (e) {
        console.warn('[BookCache] Transaction exception:', e);
        resolve(false);
      }
    });
  },

  /**
   * Update lastAccessedAt timestamp for LRU tracking
   */
  async touch(fileId) {
    try {
      const db = await this.open();
      if (!db) return;
      const tx = db.transaction([this.STORE_NAME], 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.get(fileId);
      req.onsuccess = () => {
        const record = req.result;
        if (record) {
          record.lastAccessedAt = Date.now();
          store.put(record);
        }
      };
    } catch (_) {}
  },

  /**
   * Delete a single book from IndexedDB
   */
  async delete(fileId) {
    try {
      const db = await this.open();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction([this.STORE_NAME], 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.delete(fileId);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (_) {
      return false;
    }
  },

  /**
   * Purge all cached books from IndexedDB
   */
  async clear() {
    try {
      const db = await this.open();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction([this.STORE_NAME], 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('[BookCache] Clear failed:', err);
      return false;
    }
  },

  /**
   * Retrieve storage statistics and cached book metadata list without keeping buffers in memory
   */
  async getStats() {
    try {
      const db = await this.open();
      if (!db) return { count: 0, totalSizeBytes: 0, totalSizeFormatted: '0 B', books: [] };

      return new Promise((resolve) => {
        const tx = db.transaction([this.STORE_NAME], 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.openCursor();
        let count = 0;
        let totalBytes = 0;
        const books = [];

        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            count++;
            const size = val.sizeBytes || (val.buffer ? val.buffer.byteLength : 0);
            totalBytes += size;
            books.push({
              fileId: val.fileId,
              name: val.name || 'Untitled Document',
              format: val.format || 'EPUB',
              sizeBytes: size,
              cachedAt: val.cachedAt,
              lastAccessedAt: val.lastAccessedAt
            });
            cursor.continue();
          } else {
            resolve({
              count,
              totalSizeBytes: totalBytes,
              totalSizeFormatted: BookCache.formatBytes(totalBytes),
              books
            });
          }
        };

        req.onerror = () => {
          resolve({ count: 0, totalSizeBytes: 0, totalSizeFormatted: '0 B', books: [] });
        };
      });
    } catch (_) {
      return { count: 0, totalSizeBytes: 0, totalSizeFormatted: '0 B', books: [] };
    }
  },

  /**
   * Evict LRU entries if adding incomingSize exceeds MAX_BUDGET_BYTES
   */
  async evictIfNeeded(incomingSize = 0) {
    if (incomingSize > this.MAX_BUDGET_BYTES) return false;
    const stats = await this.getStats();
    let currentTotal = stats.totalSizeBytes;

    if (currentTotal + incomingSize <= this.MAX_BUDGET_BYTES) {
      return true;
    }

    // Sort ascending by lastAccessedAt (oldest accessed first)
    const sorted = stats.books.sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));

    for (const item of sorted) {
      if (currentTotal + incomingSize <= this.MAX_BUDGET_BYTES) break;
      console.info(`[BookCache] LRU evicting "${item.name}" (${item.fileId}) to free ${item.sizeBytes} bytes.`);
      await this.delete(item.fileId);
      currentTotal -= item.sizeBytes;
    }

    return true;
  },

  /**
   * Evict oldest accessed entries to free at least bytesToFree
   */
  async evictOldest(bytesToFree = 0) {
    const stats = await this.getStats();
    const sorted = stats.books.sort((a, b) => (a.lastAccessedAt || 0) - (b.lastAccessedAt || 0));
    let freed = 0;

    for (const item of sorted) {
      if (freed >= bytesToFree) break;
      await this.delete(item.fileId);
      freed += item.sizeBytes;
    }
  },

  /**
   * Format byte count into human-readable string
   */
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2) + ' ' + sizes[i];
  }
};

window.BookCache = BookCache;
