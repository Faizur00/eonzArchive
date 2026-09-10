require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { rateLimit } = require('express-rate-limit');

const DriveService = require('./src/services/driveService');
const AnnotationService = require('./src/services/annotationService');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PROJECT_ROOT = __dirname;

// Per-process secret required on every /api request via the X-Request-Token header.
// The server embeds the token into the served index.html so the same-origin UI can send it.
// A cross-origin page cannot read the HTML (no CORS) and cannot attach the header without a
// preflight (which the server rejects), so this blocks both data exfiltration and CSRF.
const API_TOKEN = process.env.API_TOKEN || crypto.randomBytes(64).toString('hex');

function isWeakToken(token) {
  if (!token || typeof token !== 'string') return true;
  if (token.length < 32) return true;

  const lower = token.toLowerCase();
  const commonWeakWords = [
    'change-me', 'secret', 'password', 'admin', 'token', 'test',
    'default', 'demo', 'archive', 'eonz', 'faizur', 'user',
    'welcome', 'qwerty', '123456'
  ];
  if (commonWeakWords.some(word => lower.includes(word))) return true;
  if (/^[a-zA-Z]+$/.test(token)) return true;
  if (/^[a-zA-Z]+[0-9]+$/.test(token)) return true;
  if (/(\b(19\d\d|20\d\d)\b|\d{6,8})/.test(token) && !/^[0-9a-fA-F]{64,}$/.test(token)) return true;

  const uniqueChars = new Set(lower).size;
  if (uniqueChars < 8) return true;

  return false;
}

if (process.env.API_TOKEN && isWeakToken(process.env.API_TOKEN)) {
  console.warn('\x1b[33m⚠️  [SECURITY WARNING] API_TOKEN appears weak, dictionary-based, or contains common patterns.\x1b[0m');
  console.warn('\x1b[33m   Generate a cryptographically secure token with: openssl rand -hex 32\x1b[0m');
}

// Host allowlist defeats DNS-rebinding attacks. Defaults to loopback aliases; extend via ALLOWED_HOSTS.
const allowedHosts = new Set(
  ['localhost', '127.0.0.1', '[::1]']
    .concat((process.env.ALLOWED_HOSTS || '').split(',').map(h => h.trim()).filter(Boolean))
);

app.set('trust proxy', 1);
app.use(express.json());

// Reject requests whose Host header is not allowed.
app.use((req, res, next) => {
  const hostRaw = String(req.headers.host || '').toLowerCase();
  const host = hostRaw.startsWith('[')
    ? hostRaw.slice(0, hostRaw.indexOf(']') + 1)
    : hostRaw.split(':')[0];
  if (
    process.env.VERCEL ||
    host.endsWith('.vercel.app') ||
    allowedHosts.has(host) ||
    process.env.DISABLE_HOST_CHECK === 'true'
  ) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Forbidden host' });
});

// Require the request token on all API calls (via header or query parameter).
app.use('/api', (req, res, next) => {
  const token = req.headers['x-request-token'] || req.query.token;
  if (typeof token !== 'string' || token !== API_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});

// Rate limiters (Step 2, Step 6)
function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: message },
    handler: (req, res, next, options) => {
      if (req.rateLimit) {
        res.setHeader('RateLimit-Limit', req.rateLimit.limit);
        res.setHeader('RateLimit-Remaining', req.rateLimit.remaining);
        res.setHeader('RateLimit-Reset', Math.ceil((new Date(req.rateLimit.resetTime).getTime() - Date.now()) / 1000));
      }
      res.status(options.statusCode).json(options.message);
    }
  });
}

const addRateLimitHeaders = (req, res, next) => {
  if (req.rateLimit) {
    res.setHeader('RateLimit-Limit', req.rateLimit.limit);
    res.setHeader('RateLimit-Remaining', req.rateLimit.remaining);
    res.setHeader('RateLimit-Reset', Math.ceil((new Date(req.rateLimit.resetTime).getTime() - Date.now()) / 1000));
  }
  next();
};

const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  message: 'Too many requests from this IP, please try again later.'
});

const streamLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many stream requests from this IP, please try again later.'
});

const syncLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: 'Too many sync requests from this IP, please try again later.'
});

// Mount rate limiters after token verification
app.use('/api', globalLimiter, addRateLimitHeaders);
app.use('/api/book/:id/stream', streamLimiter, addRateLimitHeaders);
app.use('/api/sync', syncLimiter, addRateLimitHeaders);

// Initialize Services
const driveService = new DriveService(PROJECT_ROOT);
const annotationService = new AnnotationService(PROJECT_ROOT);

// Ensure library index is loaded from Redis/seed on cold starts
app.use('/api', async (req, res, next) => {
  try {
    await driveService.ensureLibraryLoaded();
  } catch (err) {
    console.error('Error in ensureLibraryLoaded middleware:', err.message);
  }
  next();
});

// Serve the SPA shell with the API token embedded for the same-origin frontend.
function serveApp(req, res) {
  const templatePath = fs.existsSync(path.join(__dirname, 'web', 'index.html'))
    ? path.join(__dirname, 'web', 'index.html')
    : path.join(__dirname, 'public', 'index.html');
  const html = fs.readFileSync(templatePath, 'utf8');
  res.type('html').send(
    html.replace('</head>', `<script>window.__API_TOKEN = ${JSON.stringify(API_TOKEN)};</script></head>`)
  );
}

app.get('/', serveApp);
app.get('/index.html', serveApp);
app.get('/library', (req, res) => res.redirect('/#/'));
app.get('/folder/:id', (req, res) => res.redirect(`/#/folder/${encodeURIComponent(req.params.id)}`));
app.get('/read/:id', (req, res) => res.redirect(`/#/read/${encodeURIComponent(req.params.id)}`));

// Serve static frontend from public/ and web/ (index.html is handled by serveApp so the token is embedded)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
}
app.use(express.static(path.join(__dirname, 'web'), { index: false }));

// Serve kookit library assets
app.use('/kookit', express.static(path.join(__dirname, 'kookit')));
if (fs.existsSync(path.join(publicDir, 'kookit'))) {
  app.use('/kookit', express.static(path.join(publicDir, 'kookit')));
}

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
    const force = req.query.force === 'true' || Boolean(req.body && req.body.force);
    const result = await driveService.sync(force);
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
 * POST /api/book/:id/cache - Pre-cache endpoint stub (zero disk cache mode)
 */
app.post('/api/book/:id/cache', (req, res) => {
  res.json({
    success: true,
    message: 'Server-side disk caching is disabled. Documents stream directly from Google Drive.',
    data: { id: req.params.id, size: 0, source: 'stream' }
  });
});

/**
 * DELETE /api/book/:id/cache - Delete cached file endpoint stub (zero disk cache mode)
 */
app.delete('/api/book/:id/cache', (req, res) => {
  res.json({ success: true, data: { success: true, deleted: false } });
});

/**
 * GET /api/cache/stats - Cache usage details (0 B on disk)
 */
app.get('/api/cache/stats', (req, res) => {
  res.json({
    success: true,
    data: { count: 0, totalBytes: 0, totalBytesFormatted: '0 B', files: [] }
  });
});

/**
 * DELETE /api/cache - Clear cache endpoint stub (0 B on disk)
 */
app.delete('/api/cache', (req, res) => {
  res.json({ success: true, data: { success: true, count: 0 } });
});

/**
 * GET /api/book/:id/annotations - Get all annotations for a specific book
 */
app.get('/api/book/:id/annotations', async (req, res) => {
  try {
    const annotations = await annotationService.getAnnotations(req.params.id);
    res.json({ success: true, data: annotations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/book/:id/annotations - Save/sync annotations (single or list) for a book
 */
app.post('/api/book/:id/annotations', async (req, res) => {
  try {
    const body = req.body;
    if (Array.isArray(body)) {
      const result = await annotationService.saveAnnotations(req.params.id, body);
      return res.json({ success: true, data: result });
    } else if (body && typeof body === 'object') {
      const saved = await annotationService.upsertAnnotation(req.params.id, body);
      return res.json({ success: true, data: saved });
    }
    res.status(400).json({ success: false, error: 'Invalid annotations payload' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/book/:id/annotations/:annotationId - Delete a single annotation
 */
app.delete('/api/book/:id/annotations/:annotationId', async (req, res) => {
  try {
    const result = await annotationService.deleteAnnotation(req.params.id, req.params.annotationId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/book/:id/stream - Stream book content directly from Google Drive (zero disk cache)
 */
app.get('/api/book/:id/stream', async (req, res) => {
  try {
    const fileId = req.params.id;
    const range = req.headers.range;

    const { driveRes, book } = await driveService.getDriveStream(fileId, range);

    // Determine content type
    let contentType = book.mimeType || 'application/octet-stream';
    const ext = path.extname(book.name || '').toLowerCase();
    if (ext === '.epub') contentType = 'application/epub+zip';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.mobi') contentType = 'application/x-mobipocket-ebook';
    else if (ext === '.txt') contentType = 'text/plain; charset=utf-8';
    else if (ext === '.md') contentType = 'text/markdown; charset=utf-8';

    // Support HTTP Range requests (crucial for PDF.js / large document streaming)
    if (driveRes.status === 206) {
      const contentRange = driveRes.headers.get ? driveRes.headers.get('content-range') : driveRes.headers['content-range'];
      const contentLength = driveRes.headers.get ? driveRes.headers.get('content-length') : driveRes.headers['content-length'];

      const head = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'X-Cache-Source': 'drive-direct'
      };
      if (contentRange) head['Content-Range'] = contentRange;
      if (contentLength) head['Content-Length'] = contentLength;

      res.writeHead(206, head);
    } else {
      const contentLength = (driveRes.headers.get ? driveRes.headers.get('content-length') : driveRes.headers['content-length']) || (book.size ? String(book.size) : undefined);
      const head = {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(book.name || fileId)}"`,
        'X-Cache-Source': 'drive-direct'
      };
      if (contentLength) head['Content-Length'] = contentLength;

      res.writeHead(200, head);
    }

    // Abort Google Drive request if client aborts early
    req.on('close', () => {
      if (driveRes.data && !driveRes.data.destroyed) {
        driveRes.data.destroy();
      }
    });

    driveRes.data.on('error', (streamErr) => {
      console.error(`Stream error for "${book.name}":`, streamErr.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: streamErr.message });
      }
    });

    driveRes.data.pipe(res);
  } catch (err) {
    console.error('Error streaming book from Drive:', err.message);
    if (!res.headersSent) {
      const statusCode = err.statusCode || (err.message === 'Book not found in library' ? 404 : 500);
      res.status(statusCode).json({ success: false, error: err.message });
    }
  }
});

// Fallback to the SPA shell (with embedded API token) for any unmatched route
app.use(serveApp);

// Start Server when run directly
if (require.main === module) {
  app.listen(PORT, HOST, async () => {
    console.log(`🚀 Personal Ebook Archive Server running at http://${HOST}:${PORT}`);
    console.log(`📖 Web UI accessible at http://localhost:${PORT}`);

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
}

module.exports = app;
