require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

const CacheService = require('./src/services/cacheService');
const DriveService = require('./src/services/driveService');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PROJECT_ROOT = __dirname;

// Per-process secret required on every /api request via the X-Request-Token header.
// The server embeds the token into the served index.html so the same-origin UI can send it.
// A cross-origin page cannot read the HTML (no CORS) and cannot attach the header without a
// preflight (which the server rejects), so this blocks both data exfiltration and CSRF.
const API_TOKEN = process.env.API_TOKEN || crypto.randomBytes(32).toString('hex');

// Host allowlist defeats DNS-rebinding attacks. Defaults to loopback aliases; extend via ALLOWED_HOSTS.
const allowedHosts = new Set(
  ['localhost', '127.0.0.1', '[::1]']
    .concat((process.env.ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean))
);

app.use(express.json());

// Reject requests whose Host header is not allowed.
app.use((req, res, next) => {
  const hostRaw = String(req.headers.host || '').toLowerCase();
  const host = hostRaw.startsWith('[')
    ? hostRaw.slice(0, hostRaw.indexOf(']') + 1)
    : hostRaw.split(':')[0];
  if (!allowedHosts.has(host)) {
    return res.status(403).json({ success: false, error: 'Forbidden host' });
  }
  next();
});

// Require the request token on all API calls.
app.use('/api', (req, res, next) => {
  const token = req.headers['x-request-token'];
  if (typeof token !== 'string' || token !== API_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

// Initialize Services
const cacheService = new CacheService(PROJECT_ROOT);
const driveService = new DriveService(PROJECT_ROOT, cacheService);

// Serve the SPA shell with the API token embedded for the same-origin frontend.
function serveApp(req, res) {
  const html = fs.readFileSync(path.join(__dirname, 'web', 'index.html'), 'utf8');
  res.type('html').send(
    html.replace('</head>', `<script>window.__API_TOKEN = ${JSON.stringify(API_TOKEN)};</script></head>`)
  );
}

app.get('/', serveApp);
app.get('/index.html', serveApp);
app.get('/library', (req, res) => res.redirect('/#/'));
app.get('/folder/:id', (req, res) => res.redirect(`/#/folder/${encodeURIComponent(req.params.id)}`));
app.get('/read/:id', (req, res) => res.redirect(`/#/read/${encodeURIComponent(req.params.id)}`));

// Serve static frontend from web/ (index.html is handled by serveApp so the token is embedded)
app.use(express.static(path.join(__dirname, 'web'), { index: false }));

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

// Fallback to the SPA shell (with embedded API token) for any unmatched route
app.use(serveApp);

// Start Server
app.listen(PORT, HOST, async () => {
  console.log(`🚀 Personal Ebook Archive Server running at http://${HOST}:${PORT}`);
  console.log(`📖 Web UI accessible at http://localhost:${PORT}`);

  // Log the custom domain, when the Caddy reverse proxy routes it to this container.
  const customDomain = process.env.CUSTOM_DOMAIN || 'eonzarchive.local';
  if (customDomain) {
    console.log(`🌐 Reachable at http://${customDomain} (via reverse proxy)`);
  }

  // Log every reachable address (LAN IP + any bridge/container IPs)
  const addresses = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  if (addresses.length > 0) {
    for (const addr of addresses) {
      console.log(`🌐 Reachable from other devices at http://${addr}:${PORT}`);
    }
  }

  // Perform an initial background sync if library is empty
  const status = await driveService.getStatus();
  if (status.stats.totalBooks === 0 && status.connected && status.rootFolder.id) {
    console.log('🔄 Initial library empty. Running first sync with Google Drive...');
    driveService.sync().catch(e => console.error('Initial sync error:', e.message));
  }
});
