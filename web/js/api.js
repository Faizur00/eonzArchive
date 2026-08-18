/**
 * EonzArchive API Client Module
 */

const API = {
  async request(endpoint, options = {}) {
    const token = window.__API_TOKEN || '';
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('X-Request-Token', token);
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
      options.body = JSON.stringify(options.body);
    }
    options.headers = headers;

    try {
      const response = await fetch(endpoint, options);
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      return json.data;
    } catch (err) {
      console.error(`API Error on [${endpoint}]:`, err);
      throw err;
    }
  },

  getStatus() {
    return this.request('/api/status');
  },

  triggerSync() {
    return this.request('/api/sync', { method: 'POST' });
  },

  getLibrary() {
    return this.request('/api/library');
  },

  getFiles(params = {}) {
    const query = new URLSearchParams();
    if (params.folderId) query.set('folderId', params.folderId);
    if (params.search) query.set('search', params.search);
    if (params.format && params.format !== 'ALL') query.set('format', params.format);
    if (params.cachedOnly) query.set('cachedOnly', 'true');
    if (params.sort) query.set('sort', params.sort);
    
    const qs = query.toString();
    return this.request(`/api/files${qs ? '?' + qs : ''}`);
  },

  getBookInfo(fileId) {
    return this.request(`/api/book/${fileId}/info`);
  },

  cacheBook(fileId) {
    return this.request(`/api/book/${fileId}/cache`, { method: 'POST' });
  },

  deleteBookCache(fileId) {
    return this.request(`/api/book/${fileId}/cache`, { method: 'DELETE' });
  },

  getCacheStats() {
    return this.request('/api/cache/stats');
  },

  clearAllCache() {
    return this.request('/api/cache', { method: 'DELETE' });
  }
};

window.API = API;
