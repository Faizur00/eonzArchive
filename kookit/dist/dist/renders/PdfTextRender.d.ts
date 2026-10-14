import GeneralRender from "./GeneralRender";
declare class PdfTextRender extends GeneralRender {
    pdfBuffer: ArrayBuffer;
    password: string;
    isScannedPDF: string;
    worker: any;
    cache: any;
    processingPromises: Map<number, Promise<void>>;
    ocrLang: string;
    serverRegion: string;
    paraSpacingValue: number;
    titleSizeValue: number;
    isFinishOCR: boolean;
    ocrEngine: string;
    shouldShowProgress: boolean;
    externalWorker: any;
    pdfPageCount: number;
    pdfDoc: any;
    constructor(pdfBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    processCurrentChapter(index: number): Promise<string>;
    preProcessNextChapters(currentIndex: number): Promise<void>;
    processChapterOCR(index: number): Promise<void>;
    /**
     * 启动一个模拟进度条，从 0 缓慢爬升到 maxProgress（不超过该值）。
     * @param maxProgress 最大模拟进度，默认 0.85
     * @param duration    预估总时长（ms），用于控制爬升速度，默认 30000ms
     * @returns 停止函数，调用后清除定时器
     */
    startFakeProgress(maxProgress?: number, duration?: number): () => void;
    performBuiltInOCR: (imageUrl: any) => Promise<any>;
    extractPages: (pages: any) => Promise<Blob>;
    getTextByOCR(chapterDoc: any, chapterDocIndex: number): Promise<string>;
    getTextFromDoc(chapterDoc: any): Promise<string>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
    getMetadata(): Promise<any>;
}
export default PdfTextRender;
