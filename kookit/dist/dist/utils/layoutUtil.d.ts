export declare const isVerticalLayout: () => boolean;
export declare const convertStyleNum: (value: number) => number;
export declare const convertComputedNum: (value: string) => number;
export declare const handleIframeHeight: (element: HTMLElement, readerMode: string, format: string, iframe: any, doc: Document) => Promise<void>;
export declare const handleOneChapterDoc: (item: any, isSearch: boolean) => Promise<string>;
export declare const getImageElement: (Element: any) => HTMLElement[];
export declare const getImageUrl: (el: Element) => string | null;
export declare const collectChapterImageUrls: (root: Element) => string[];
export declare const handlePrecacheAssets: (bookStr: any, item: any) => Promise<any>;
export declare const createIframe: (element: HTMLElement, isAllowScript: string, scale?: number | undefined) => void;
export declare const progressInfo: (readerMode: string, doc: Document, element: any) => {
    totalPage: number;
    currentPage: number;
};
export declare const transformText: (doc: Document) => Promise<void>;
export declare const handleTextStyle: (doc: Document) => Promise<void>;
export declare const getImageMeta: (url: any) => Promise<HTMLImageElement>;
export declare const handleImageSize: (element: HTMLElement, readerMode: string, format: string, doc: Document) => Promise<void>;
export declare const handleLayout: (element: HTMLElement, readerMode: string, doc: Document) => void;
export declare const isElement: (obj: any) => boolean;
export declare function getSelectedElement(doc: Document): HTMLElement | null;
/**
 * 向文档文本节点注入软连字符（U+00AD），解决 Electron 无 Chromium 连字词典时
 * `hyphens: auto` 静默失效的问题。CSS 规范保证：即使 hyphens:auto 无词典，
 * 浏览器仍会在 \u00AD 处断行并插入可见连字符。
 *
 * 调用时机：章节内容渲染完成后，在 Electron 环境中调用。
 * @param doc - iframe 的 contentDocument
 */
export declare const applyHyphenation: (doc: Document) => void;
