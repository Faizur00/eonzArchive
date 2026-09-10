const fs = require('fs');
const path = require('path');
const { Redis } = require('@upstash/redis');

class AnnotationService {
  constructor(baseDir) {
    const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.resolve(baseDir, 'data'));
    this.annotationsDir = path.resolve(dataDir, 'annotations');

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken) {
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken
      });
    } else {
      this.redis = null;
      this.ensureDir();
    }
  }

  ensureDir() {
    if (!fs.existsSync(this.annotationsDir)) {
      fs.mkdirSync(this.annotationsDir, { recursive: true });
    }
  }

  getFilePath(fileId) {
    const sanitizedId = fileId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.annotationsDir, `${sanitizedId}.json`);
  }

  /**
   * Get all annotations for a book
   */
  async getAnnotations(fileId) {
    if (this.redis) {
      try {
        const data = await this.redis.get(`annotations:${fileId}`);
        if (!data) return [];
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
          } catch (_) {
            return [];
          }
        }
        return Array.isArray(data) ? data : [];
      } catch (err) {
        console.error(`Error reading annotations from Redis for ${fileId}:`, err.message);
        return [];
      }
    }

    this.ensureDir();
    const filePath = this.getFilePath(fileId);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error(`Error reading annotations for ${fileId}:`, err.message);
      return [];
    }
  }

  /**
   * Save all annotations for a book (replace/batch update)
   */
  async saveAnnotations(fileId, annotations) {
    const validList = Array.isArray(annotations) ? annotations : [];

    if (this.redis) {
      try {
        await this.redis.set(`annotations:${fileId}`, validList);
        return { success: true, count: validList.length };
      } catch (err) {
        console.error(`Error saving annotations to Redis for ${fileId}:`, err.message);
        throw err;
      }
    }

    this.ensureDir();
    const filePath = this.getFilePath(fileId);
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(validList, null, 2), 'utf8');
      fs.renameSync(tempPath, filePath);
      return { success: true, count: validList.length };
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      console.error(`Error saving annotations for ${fileId}:`, err.message);
      throw err;
    }
  }

  /**
   * Upsert a single annotation
   */
  async upsertAnnotation(fileId, annotation) {
    if (!annotation || !annotation.id) {
      throw new Error('Annotation must contain a valid id');
    }
    const current = await this.getAnnotations(fileId);
    const index = current.findIndex(a => a.id === annotation.id);
    const now = Date.now();
    const item = {
      ...annotation,
      updatedAt: now,
      createdAt: annotation.createdAt || now
    };

    if (index >= 0) {
      current[index] = item;
    } else {
      current.push(item);
    }

    await this.saveAnnotations(fileId, current);
    return item;
  }

  /**
   * Delete a single annotation
   */
  async deleteAnnotation(fileId, annotationId) {
    const current = await this.getAnnotations(fileId);
    const filtered = current.filter(a => a.id !== annotationId);
    await this.saveAnnotations(fileId, filtered);
    return { success: true, deleted: current.length !== filtered.length };
  }
}

module.exports = AnnotationService;
