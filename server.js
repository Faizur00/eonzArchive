require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const CacheService = require('./src/services/cacheService');
const DriveService = require('./src/services/driveService');

const app = express();
const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = __dirname;

app.use(cors());
app.use(express.json());

// Initialize Services
const cacheService = new CacheService(PROJECT_ROOT);
const driveService = new DriveService(PROJECT_ROOT, cacheService);

// Serve static frontend from web/
app.use(express.static(path.join(__dirname, 'web')));

// Serve kookit library assets if needed
app.use('/kookit', express.static(path.join(__dirname, 'kookit')));

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * GET /api/status - Get system health, Google Drive connection, folder status, and storage stats
 */
app.get('/api/status', async (req, res) => {
  try {
    const status = await driveService.getStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sync - Manually trigger a full sync with Google Drive folder
 */
app.post('/api/sync', async (req, res) => {
  try {
    const result = await driveService.sync();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/library - Get full synced library tree & stats
 */
app.get('/api/library', (req, res) => {
  try {
    const library = driveService.libraryData;
    const stats = driveService.calculateStats();
    res.json({
      success: true,
      data: {
        ...library,
        stats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/files - Get files and folders for a specific folder or filtered search
 * Query parameters:
 *  - folderId: Google Drive folder ID (defaults to root)
 *  - search: string filter
 *  - format: 'EPUB', 'PDF', etc.
 *  - cachedOnly: 'true' | 'false'
 *  - sort: 'name' | 'size_desc' | 'size_asc' | 'date_desc'
 */
app.get('/api/files', (req, res) => {
  try {
    const { folderId, search, format, cachedOnly, sort } = req.query;
    const result = driveService.getFolderContents(folderId, {
      search,
      format,
      cachedOnly,
      sort
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/book/:id/info - Get metadata and cache status for a specific book
 */
app.get('/api/book/:id/info', (req, res) => {
  try {
    const book = driveService.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found in library index' });
    }
    res.json({ success: true, data: book });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/book/:id/cache - Pre-cache a book on demand without streaming to client
 */
app.post('/api/book/:id/cache', async (req, res) => {
  try {
    const result = await driveService.getBookFile(req.params.id);
    res.json({
      success: true,
      message: 'Book successfully cached',
      data: {
        id: req.params.id,
        filename: result.filename,
        size: result.size,
        source: result.source
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/book/:id/cache - Delete cached file for a book
 */
app.delete('/api/book/:id/cache', (req, res) => {
  try {
    const result = cacheService.deleteCache(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cache/stats - Get cache usage details
 */
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = cacheService.getCacheStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/cache - Clear all cached books
 */
app.delete('/api/cache', (req, res) => {
  try {
    const result = cacheService.clearAllCache();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/book/:id/stream - Stream book content to browser / reader (caches on demand)
 */
app.get('/api/book/:id/stream', async (req, res) => {
  try {
    const bookFile = await driveService.getBookFile(req.params.id);
    const filePath = bookFile.path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk cache' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type
    let contentType = bookFile.mimeType || 'application/octet-stream';
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.epub') contentType = 'application/epub+zip';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.mobi') contentType = 'application/x-mobipocket-ebook';
    else if (ext === '.txt') contentType = 'text/plain; charset=utf-8';
    else if (ext === '.md') contentType = 'text/markdown; charset=utf-8';

    // Support HTTP Range requests (crucial for large PDF rendering, audio, etc.)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'X-Cache-Source': bookFile.source
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(bookFile.book?.name || bookFile.filename)}"`,
        'X-Cache-Source': bookFile.source
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Error streaming book:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Personal Ebook Archive Server running at http://localhost:${PORT}`);
  console.log(`📖 Web UI accessible at http://localhost:${PORT}`);

  // Perform an initial background sync if library is empty
  const status = await driveService.getStatus();
  if (status.stats.totalBooks === 0 && status.connected && status.rootFolder.id) {
    console.log('🔄 Initial library empty. Running first sync with Google Drive...');
    driveService.sync().catch(e => console.error('Initial sync error:', e.message));
  }
});
