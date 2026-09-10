/**
 * OCR 资源缓存工具
 * 用于缓存 OCR 引擎所需的各种资源文件到 IndexedDB
 */
interface CacheEntry {
    url: string;
    data: ArrayBuffer | string;
    timestamp: number;
    type: "arraybuffer" | "text" | "blob";
}
declare class OCRCacheUtil {
    private db;
    /**
     * 判断 URL 是否为远程资源（http/https）
     */
    private isRemoteUrl;
    /**
     * 初始化 IndexedDB
     */
    init(): Promise<void>;
    /**
     * 从缓存获取资源
     */
    get(url: string): Promise<CacheEntry | null>;
    /**
     * 保存资源到缓存
     */
    set(url: string, data: ArrayBuffer | string, type: "arraybuffer" | "text" | "blob"): Promise<void>;
    /**
     * 删除指定缓存
     */
    delete(url: string): Promise<void>;
    /**
     * 清空所有缓存
     */
    clear(): Promise<void>;
    /**
     * 获取所有缓存的 URL
     */
    getAllKeys(): Promise<string[]>;
    /**
     * 带缓存的资源获取（文本）
     */
    fetchText(url: string): Promise<string>;
    /**
     * 带缓存的资源获取（ArrayBuffer）
     */
    fetchArrayBuffer(url: string): Promise<ArrayBuffer>;
    /**
     * 带缓存的资源获取（Blob URL）
     * 用于需要 Blob URL 的场景（如 Worker）
     */
    fetchBlobURL(url: string, mimeType?: string): Promise<string>;
    /**
     * 获取缓存统计信息
     */
    getCacheStats(): Promise<{
        count: number;
        totalSize: number;
        keys: string[];
    }>;
    /**
     * 创建一个自定义的 fetch 拦截器，用于自动缓存所有请求
     * 返回一个代理 fetch 函数
     */
    createCachedFetch(): typeof fetch;
    /**
     * 安装全局 fetch 拦截器（谨慎使用）
     */
    installGlobalFetchInterceptor(): void;
    /**
     * 创建支持缓存的 Worker Blob URL
     * 用于拦截 Worker 内部的 importScripts 调用
     */
    createCachedWorkerBlob(originalWorkerUrl: string, cacheInstance: OCRCacheUtil): Promise<string>;
    /**
     * 为 Tesseract 创建自定义的资源加载器
     * 通过 Service Worker 或代理服务器实现缓存
     */
    setupTesseractCacheProxy(): Promise<{
        getCachedUrl: (url: string) => Promise<string>;
    }>;
    /**
     * 恢复原始 fetch
     */
    restoreOriginalFetch(): void;
}
export declare const ocrCache: OCRCacheUtil;
export {};
