const fs = require('fs');
const path = require('path');

class AnnotationService {
  constructor(baseDir) {
    this.annotationsDir = path.resolve(baseDir, 'data', 'annotations');
    this.ensureDir();
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
  getAnnotations(fileId) {
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
  saveAnnotations(fileId, annotations) {
    this.ensureDir();
    const filePath = this.getFilePath(fileId);
    const validList = Array.isArray(annotations) ? annotations : [];
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
  upsertAnnotation(fileId, annotation) {
    if (!annotation || !annotation.id) {
      throw new Error('Annotation must contain a valid id');
    }
    const current = this.getAnnotations(fileId);
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

    this.saveAnnotations(fileId, current);
    return item;
  }

  /**
   * Delete a single annotation
   */
  deleteAnnotation(fileId, annotationId) {
    const current = this.getAnnotations(fileId);
    const filtered = current.filter(a => a.id !== annotationId);
    this.saveAnnotations(fileId, filtered);
    return { success: true, deleted: current.length !== filtered.length };
  }
}

module.exports = AnnotationService;
