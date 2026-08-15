const fs = require('fs');
const path = require('path');

/**
 * Extracts a Google Drive folder ID from various URL formats or raw ID.
 * Examples:
 * - https://drive.google.com/drive/folders/1aLiI-3PnRtTB8mEfJeHuTp1f2thui--M?usp=drive_link
 * - https://drive.google.com/drive/u/0/folders/1aLiI-3PnRtTB8mEfJeHuTp1f2thui--M
 * - https://drive.google.com/open?id=1aLiI-3PnRtTB8mEfJeHuTp1f2thui--M
 * - 1aLiI-3PnRtTB8mEfJeHuTp1f2thui--M
 */
function extractFolderId(urlOrId) {
  if (!urlOrId) return null;
  const str = String(urlOrId).trim();

  // Match /folders/([a-zA-Z0-9_-]+)
  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];

  // Match ?id=([a-zA-Z0-9_-]+)
  const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  // If it looks like a direct ID (alphanumeric with underscores/hyphens)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(str)) {
    return str;
  }

  return str;
}

/**
 * Automatically locates the service account JSON key file in the workspace
 * without revealing credentials.
 */
function findServiceAccountKeyFile(projectRoot) {
  // 1. Check environment variables
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = path.resolve(projectRoot, process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(credPath)) {
      return credPath;
    }
  }
  if (process.env.SERVICE_ACCOUNT_KEY_PATH) {
    const credPath = path.resolve(projectRoot, process.env.SERVICE_ACCOUNT_KEY_PATH);
    if (fs.existsSync(credPath)) {
      return credPath;
    }
  }

  // 2. Scan root directory for service account JSON files
  try {
    const files = fs.readdirSync(projectRoot);
    // Prioritize files starting with .eonzarchive- or service-account
    const matched = files.find(f => 
      (f.startsWith('.eonzarchive') || f.startsWith('service-account') || f.includes('eonzarchive')) && 
      f.endsWith('.json')
    );
    if (matched) {
      return path.join(projectRoot, matched);
    }

    // Secondary fallback: any hidden json file or credentials.json
    const fallback = files.find(f => 
      (f.endsWith('.json') && (f.startsWith('.') || f === 'credentials.json' || f === 'service_account.json')) &&
      f !== 'package.json' && f !== 'package-lock.json' && f !== 'tsconfig.json'
    );
    if (fallback) {
      return path.join(projectRoot, fallback);
    }
  } catch (err) {
    console.error('Error scanning for credentials file:', err.message);
  }

  return null;
}

/**
 * Format bytes into human-readable string (KB, MB, GB).
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get book format from filename / mimeType.
 */
function getBookFormat(filename, mimeType) {
  if (!filename) return 'UNKNOWN';
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  
  const knownFormats = {
    'epub': 'EPUB',
    'mobi': 'MOBI',
    'azw3': 'AZW3',
    'azw': 'AZW',
    'pdf': 'PDF',
    'txt': 'TXT',
    'md': 'MD',
    'docx': 'DOCX',
    'fb2': 'FB2',
    'cbr': 'CBR',
    'cbz': 'CBZ',
    'cbt': 'CBT',
    'cb7': 'CB7',
    'html': 'HTML',
    'xhtml': 'XHTML',
    'mhtml': 'MHTML'
  };

  if (knownFormats[ext]) {
    return knownFormats[ext];
  }

  if (mimeType === 'application/epub+zip') return 'EPUB';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'text/plain') return 'TXT';
  if (mimeType === 'text/markdown') return 'MD';
  
  return ext.toUpperCase() || 'FILE';
}

/**
 * Check if the file is a supported ebook/document/comic format.
 */
function isSupportedBook(filename, mimeType) {
  const supportedExtensions = [
    'epub', 'mobi', 'azw', 'azw3', 'pdf', 'txt', 'md', 
    'docx', 'fb2', 'cbr', 'cbz', 'cbt', 'cb7', 'html', 'xhtml', 'mhtml'
  ];
  const ext = (path.extname(filename || '')).toLowerCase().replace('.', '');
  if (supportedExtensions.includes(ext)) return true;

  const supportedMimeTypes = [
    'application/epub+zip',
    'application/x-mobipocket-ebook',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-fictionbook+xml',
    'application/x-cbr',
    'application/x-cbz'
  ];
  return supportedMimeTypes.includes(mimeType);
}

module.exports = {
  extractFolderId,
  findServiceAccountKeyFile,
  formatBytes,
  getBookFormat,
  isSupportedBook
};
