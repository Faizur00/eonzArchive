const fs = require('fs');
const path = require('path');
const { formatBytes } = require('../utils/gdriveHelper');

class CacheService {
  constructor(baseDir) {
    this.cacheDir = path.resolve(baseDir, 'data', 'cache', 'books');
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generates a safe local cache filename for a fileId and original name
   */
  getCacheFilename(fileId, originalName = '') {
    const ext = path.extname(originalName) || '';
    const sanitizedName = originalName
      ? '_' + originalName.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50)
      : '';
    return `${fileId}${sanitizedName}${ext ? '' : '.book'}`;
  }

  /**
   * Find any existing cached file for this fileId
   */
  findCachedFile(fileId) {
    this.ensureCacheDir();
    try {
      const files = fs.readdirSync(this.cacheDir);
      const matched = files.find(f => f.startsWith(fileId));
      if (matched) {
        const fullPath = path.join(this.cacheDir, matched);
        const stats = fs.statSync(fullPath);
        return {
          exists: true,
          path: fullPath,
          filename: matched,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          cachedAt: stats.mtime
        };
      }
    } catch (e) {
      console.error('Error finding cached file:', e.message);
    }
    return { exists: false, path: null, size: 0 };
  }

  /**
   * Saves a readable stream into the local cache atomically
   */
  saveStreamToCache(fileId, originalName, inputStream) {
    return new Promise((resolve, reject) => {
      this.ensureCacheDir();
      const targetFilename = this.getCacheFilename(fileId, originalName);
      const targetPath = path.join(this.cacheDir, targetFilename);
      const tempPath = path.join(this.cacheDir, `${targetFilename}.${Date.now()}.tmp`);

      const outStream = fs.createWriteStream(tempPath);

      inputStream.on('error', (err) => {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
        reject(err);
      });

      outStream.on('error', (err) => {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
        reject(err);
      });

      outStream.on('finish', () => {
        try {
          // Atomic rename
          fs.renameSync(tempPath, targetPath);
          const stats = fs.statSync(targetPath);
          resolve({
            path: targetPath,
            filename: targetFilename,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            cachedAt: stats.mtime
          });
        } catch (err) {
          reject(err);
        }
      });

      inputStream.pipe(outStream);
    });
  }

  /**
   * Delete a single cached file
   */
  deleteCache(fileId) {
    const cached = this.findCachedFile(fileId);
    if (cached.exists && cached.path) {
      try {
        fs.unlinkSync(cached.path);
        return { success: true, deleted: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: true, deleted: false };
  }

  /**
   * Clear entire cache
   */
  clearAllCache() {
    this.ensureCacheDir();
    try {
      const files = fs.readdirSync(this.cacheDir);
      let count = 0;
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
        count++;
      }
      return { success: true, count };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get stats about the cache
   */
  getCacheStats() {
    this.ensureCacheDir();
    try {
      const files = fs.readdirSync(this.cacheDir).filter(f => !f.endsWith('.tmp'));
      let totalBytes = 0;
      const cachedList = [];

      for (const file of files) {
        const fullPath = path.join(this.cacheDir, file);
        const stats = fs.statSync(fullPath);
        totalBytes += stats.size;
        
        // Extract fileId
        const fileId = file.split('_')[0].split('.')[0];
        cachedList.push({
          fileId,
          filename: file,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          cachedAt: stats.mtime
        });
      }

      return {
        count: files.length,
        totalBytes,
        totalBytesFormatted: formatBytes(totalBytes),
        files: cachedList
      };
    } catch (err) {
      return {
        count: 0,
        totalBytes: 0,
        totalBytesFormatted: '0 B',
        files: []
      };
    }
  }
}

module.exports = CacheService;
