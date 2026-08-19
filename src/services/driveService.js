const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { 
  extractFolderId, 
  findServiceAccountKeyFile, 
  formatBytes, 
  getBookFormat, 
  isSupportedBook 
} = require('../utils/gdriveHelper');

class DriveService {
  constructor(projectRoot, cacheService) {
    this.projectRoot = projectRoot;
    this.cacheService = cacheService;
    this.dataFile = path.resolve(projectRoot, 'data', 'library.json');
    this.driveClient = null;
    this.authClient = null;
    this.rootFolderId = null;
    this.rootFolderInfo = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.libraryData = this.loadLibraryFromDisk();

    this.init();
  }

  ensureDataDir() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadLibraryFromDisk() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        const data = JSON.parse(raw);
        if (data && data.lastSyncTime) {
          this.lastSyncTime = new Date(data.lastSyncTime);
        }
        return data;
      }
    } catch (e) {
      console.warn('Could not read existing library data:', e.message);
    }
    return {
      rootFolder: null,
      folders: [],
      books: [],
      otherFiles: [],
      stats: {
        totalBooks: 0,
        totalFolders: 0,
        totalSizeBytes: 0,
        totalSizeFormatted: '0 B'
      },
      lastSyncTime: null
    };
  }

  saveLibraryToDisk() {
    try {
      this.ensureDataDir();
      const payload = {
        rootFolder: this.rootFolderInfo,
        folders: this.libraryData.folders || [],
        books: this.libraryData.books || [],
        otherFiles: this.libraryData.otherFiles || [],
        stats: this.calculateStats(),
        lastSyncTime: this.lastSyncTime ? this.lastSyncTime.toISOString() : null
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(payload, null, 2), 'utf8');
      this.libraryData = payload;
    } catch (e) {
      console.error('Failed to save library data to disk:', e.message);
    }
  }

  init() {
    try {
      const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      if (credentialsJson) {
        this.authClient = new google.auth.GoogleAuth({
          credentials: JSON.parse(credentialsJson),
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
      } else {
        const keyFile = findServiceAccountKeyFile(this.projectRoot);
        if (!keyFile) {
          console.warn('⚠️ No Google Service Account key file detected.');
          return;
        }

        this.authClient = new google.auth.GoogleAuth({
          keyFile: keyFile,
          scopes: ['https://www.googleapis.com/auth/drive.readonly']
        });
      }

      this.driveClient = google.drive({ version: 'v3', auth: this.authClient });

      const folderUrlOrId = process.env.ARCHIVE_FOLDER_URL;
      this.rootFolderId = extractFolderId(folderUrlOrId);

      if (this.rootFolderId) {
        console.log(`📁 Archive Folder ID configured: ${this.rootFolderId}`);
      } else {
        console.warn('⚠️ No ARCHIVE_FOLDER_URL found in environment.');
      }
    } catch (err) {
      console.error('Error initializing DriveService:', err.message);
    }
  }

  /**
   * Health and configuration check
   */
  async getStatus() {
    const keyFile = findServiceAccountKeyFile(this.projectRoot);
    const keyDetected = !!keyFile;
    const cacheStats = this.cacheService.getCacheStats();

    let rootStatus = {
      id: this.rootFolderId,
      name: this.rootFolderInfo?.name || this.libraryData.rootFolder?.name || 'Archive Folder',
      accessible: false,
      error: null
    };

    if (this.driveClient && this.rootFolderId) {
      try {
        const res = await this.driveClient.files.get({
          fileId: this.rootFolderId,
          fields: 'id, name, mimeType, modifiedTime, webViewLink',
          supportsAllDrives: true
        });
        rootStatus.name = res.data.name;
        rootStatus.accessible = true;
        this.rootFolderInfo = res.data;
      } catch (e) {
        rootStatus.error = e.message;
      }
    }

    return {
      connected: !!this.driveClient,
      keyDetected,
      rootFolder: rootStatus,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime ? this.lastSyncTime.toISOString() : null,
      stats: this.calculateStats(),
      cacheStats
    };
  }

  calculateStats() {
    const books = this.libraryData.books || [];
    const folders = this.libraryData.folders || [];
    const totalSizeBytes = books.reduce((acc, b) => acc + (parseInt(b.size) || 0), 0);
    
    // Count cached books
    const cachedCount = books.filter(b => this.cacheService.findCachedFile(b.id).exists).length;

    return {
      totalBooks: books.length,
      totalFolders: folders.length,
      totalSizeBytes,
      totalSizeFormatted: formatBytes(totalSizeBytes),
      cachedBooksCount: cachedCount
    };
  }

  /**
   * Synchronize all files and folders recursively from Google Drive
   */
  async sync(force = false) {
    if (this.isSyncing) {
      return { status: 'in_progress', message: 'Sync already in progress' };
    }

    if (!this.driveClient) {
      this.init();
      if (!this.driveClient) {
        throw new Error('Google Drive client is not initialized. Please verify credentials file.');
      }
    }

    if (!this.rootFolderId) {
      const folderUrlOrId = process.env.ARCHIVE_FOLDER_URL;
      this.rootFolderId = extractFolderId(folderUrlOrId);
      if (!this.rootFolderId) {
        throw new Error('No ARCHIVE_FOLDER_URL defined in .env');
      }
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // 1. Fetch root folder details
      const rootRes = await this.driveClient.files.get({
        fileId: this.rootFolderId,
        fields: 'id, name, mimeType, modifiedTime, webViewLink',
        supportsAllDrives: true
      });
      this.rootFolderInfo = rootRes.data;

      const discoveredFolders = [];
      const discoveredBooks = [];
      const discoveredOther = [];

      // Breadcrumb / folder map for path tracking
      const folderPathMap = new Map();
      folderPathMap.set(this.rootFolderId, '/');

      // 2. Queue for BFS traversal of folders
      const queue = [{ id: this.rootFolderId, name: this.rootFolderInfo.name, path: '/' }];

      while (queue.length > 0) {
        const currentFolder = queue.shift();
        let pageToken = null;

        do {
          const res = await this.driveClient.files.list({
            q: `'${currentFolder.id}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, parents, webViewLink, thumbnailLink, iconLink)',
            pageSize: 100,
            pageToken: pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });

          const items = res.data.files || [];
          for (const item of items) {
            const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
            const itemPath = currentFolder.path === '/' 
              ? `/${item.name}` 
              : `${currentFolder.path}/${item.name}`;

            if (isFolder) {
              const folderObj = {
                id: item.id,
                name: item.name,
                parentId: currentFolder.id,
                path: itemPath,
                modifiedTime: item.modifiedTime,
                webViewLink: item.webViewLink
              };
              discoveredFolders.push(folderObj);
              folderPathMap.set(item.id, itemPath);
              queue.push(folderObj);
            } else {
              const format = getBookFormat(item.name, item.mimeType);
              const isBook = isSupportedBook(item.name, item.mimeType);
              const size = parseInt(item.size || 0);

              const fileObj = {
                id: item.id,
                name: item.name,
                parentId: currentFolder.id,
                parentPath: currentFolder.path,
                path: itemPath,
                mimeType: item.mimeType,
                size: size,
                sizeFormatted: formatBytes(size),
                modifiedTime: item.modifiedTime,
                md5Checksum: item.md5Checksum || null,
                format: format,
                isBook: isBook,
                webViewLink: item.webViewLink,
                thumbnailLink: item.thumbnailLink || null,
                iconLink: item.iconLink || null
              };

              if (isBook) {
                discoveredBooks.push(fileObj);
              } else {
                discoveredOther.push(fileObj);
              }
            }
          }

          pageToken = res.data.nextPageToken;
        } while (pageToken);
      }

      // 3. Compare with old data to calculate diff
      const oldBooksMap = new Map((this.libraryData.books || []).map(b => [b.id, b]));
      const newBooks = discoveredBooks.filter(b => !oldBooksMap.has(b.id));
      const removedBooks = (this.libraryData.books || []).filter(b => !discoveredBooks.some(nb => nb.id === b.id));

      this.libraryData = {
        rootFolder: this.rootFolderInfo,
        folders: discoveredFolders,
        books: discoveredBooks,
        otherFiles: discoveredOther,
        stats: {
          totalBooks: discoveredBooks.length,
          totalFolders: discoveredFolders.length,
          totalSizeBytes: discoveredBooks.reduce((acc, b) => acc + (parseInt(b.size) || 0), 0),
          totalSizeFormatted: formatBytes(discoveredBooks.reduce((acc, b) => acc + (parseInt(b.size) || 0), 0))
        },
        lastSyncTime: new Date().toISOString()
      };

      this.lastSyncTime = new Date();
      this.saveLibraryToDisk();

      const durationMs = Date.now() - startTime;
      console.log(`✅ Synced with Google Drive in ${durationMs}ms: ${discoveredBooks.length} books, ${discoveredFolders.length} folders.`);

      return {
        success: true,
        durationMs,
        stats: this.calculateStats(),
        diff: {
          newBooksCount: newBooks.length,
          removedBooksCount: removedBooks.length,
          newBooks: newBooks.map(b => ({ id: b.id, name: b.name, format: b.format })),
          removedBooks: removedBooks.map(b => ({ id: b.id, name: b.name }))
        }
      };
    } catch (err) {
      console.error('Error during Google Drive sync:', err.message);
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get files and subfolders for a specific folder ID or root
   */
  getFolderContents(targetFolderId = null, query = {}) {
    const folderId = targetFolderId || this.rootFolderId;
    const allFolders = this.libraryData.folders || [];
    const allBooks = this.libraryData.books || [];

    // Attach cache status to all books dynamically
    const enrichedBooks = allBooks.map(b => {
      const cacheStatus = this.cacheService.findCachedFile(b.id);
      return {
        ...b,
        cached: cacheStatus.exists,
        cachedSize: cacheStatus.size,
        cachedSizeFormatted: cacheStatus.sizeFormatted,
        cachedAt: cacheStatus.cachedAt
      };
    });

    // Check if flat search or filter is requested
    const { search, format, cachedOnly, sort } = query;

    let filteredBooks = enrichedBooks;
    let filteredFolders = allFolders;

    if (search) {
      const s = search.toLowerCase();
      filteredBooks = filteredBooks.filter(b => b.name.toLowerCase().includes(s) || b.path.toLowerCase().includes(s));
      filteredFolders = filteredFolders.filter(f => f.name.toLowerCase().includes(s));
      // In search mode, return flat results across all folders
      return {
        currentFolder: { id: 'search', name: `Search: "${search}"`, path: '/' },
        breadcrumbs: [{ id: this.rootFolderId, name: this.rootFolderInfo?.name || 'Archive' }],
        folders: filteredFolders,
        books: filteredBooks,
        stats: {
          bookCount: filteredBooks.length,
          folderCount: filteredFolders.length
        }
      };
    }

    if (format && format !== 'ALL') {
      filteredBooks = filteredBooks.filter(b => b.format.toUpperCase() === format.toUpperCase());
    }

    if (cachedOnly === 'true' || cachedOnly === true) {
      filteredBooks = filteredBooks.filter(b => b.cached);
    }

    // Normal folder view: get direct children
    const directFolders = filteredFolders.filter(f => f.parentId === folderId);
    const directBooks = filteredBooks.filter(b => b.parentId === folderId);

    // Build breadcrumbs
    const breadcrumbs = [];
    let currId = folderId;

    if (currId === this.rootFolderId) {
      breadcrumbs.push({ id: this.rootFolderId, name: this.rootFolderInfo?.name || this.libraryData.rootFolder?.name || 'Archive' });
    } else {
      while (currId && currId !== this.rootFolderId) {
        const found = allFolders.find(f => f.id === currId);
        if (found) {
          breadcrumbs.unshift({ id: found.id, name: found.name, path: found.path });
          currId = found.parentId;
        } else {
          break;
        }
      }
      breadcrumbs.unshift({ id: this.rootFolderId, name: this.rootFolderInfo?.name || this.libraryData.rootFolder?.name || 'Archive' });
    }

    // Sorting
    if (sort === 'size_desc') {
      directBooks.sort((a, b) => b.size - a.size);
    } else if (sort === 'size_asc') {
      directBooks.sort((a, b) => a.size - b.size);
    } else if (sort === 'date_desc') {
      directBooks.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    } else {
      // Default: Alphabetical
      directBooks.sort((a, b) => a.name.localeCompare(b.name));
    }
    directFolders.sort((a, b) => a.name.localeCompare(b.name));

    const currentFolderMeta = folderId === this.rootFolderId
      ? { id: this.rootFolderId, name: this.rootFolderInfo?.name || 'Archive Root', path: '/' }
      : (allFolders.find(f => f.id === folderId) || { id: folderId, name: 'Folder', path: '' });

    return {
      currentFolder: currentFolderMeta,
      breadcrumbs,
      folders: directFolders,
      books: directBooks,
      stats: {
        bookCount: directBooks.length,
        folderCount: directFolders.length
      }
    };
  }

  /**
   * Get a single book's info
   */
  getBookById(fileId) {
    const book = (this.libraryData.books || []).find(b => b.id === fileId);
    if (!book) return null;
    const cacheStatus = this.cacheService.findCachedFile(fileId);
    return {
      ...book,
      cached: cacheStatus.exists,
      cachedPath: cacheStatus.path,
      cachedSize: cacheStatus.size,
      cachedSizeFormatted: cacheStatus.sizeFormatted,
      cachedAt: cacheStatus.cachedAt
    };
  }

  /**
   * Ensure book is downloaded/cached, and return local file path or stream
   */
  async getBookFile(fileId) {
    let book = this.getBookById(fileId);
    const cached = this.cacheService.findCachedFile(fileId);

    if (cached.exists && cached.path) {
      return {
        source: 'cache',
        path: cached.path,
        filename: cached.filename,
        size: cached.size,
        mimeType: book?.mimeType || 'application/octet-stream',
        book
      };
    }

    if (!this.driveClient) {
      throw new Error('Google Drive client is not initialized.');
    }

    // If metadata not in library, fetch from GDrive
    if (!book) {
      const meta = await this.driveClient.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime',
        supportsAllDrives: true
      });
      book = {
        id: meta.data.id,
        name: meta.data.name,
        mimeType: meta.data.mimeType,
        size: parseInt(meta.data.size || 0),
        format: getBookFormat(meta.data.name, meta.data.mimeType)
      };
    }

    console.log(`📥 On-demand caching book from Google Drive: "${book.name}" (${fileId})...`);

    // Stream download from Google Drive
    const driveRes = await this.driveClient.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    // Save to local cache atomically
    const saved = await this.cacheService.saveStreamToCache(fileId, book.name, driveRes.data);
    console.log(`✅ Cached book locally: "${book.name}" (${saved.sizeFormatted})`);

    return {
      source: 'downloaded',
      path: saved.path,
      filename: saved.filename,
      size: saved.size,
      mimeType: book.mimeType || 'application/octet-stream',
      book
    };
  }
}

module.exports = DriveService;
