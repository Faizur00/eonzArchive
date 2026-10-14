import ChapterDoc from "../model/chapterDoc";
export declare const getPdfScale: (element: HTMLElement, readerMode: string, chapterDocList: ChapterDoc[], chapterDocIndex: number, doc: any) => Promise<number>;
export declare const handlePDFLayout: (element: HTMLElement, readerMode: string, doc: Document) => void;
export declare const createPDFContainer: (element: HTMLElement, chapterDocList: ChapterDoc[], viewport: any, readerMode: string, pdfCrop: {
    top: number;
    bottom: number;
    left: number;
    right: number;
}) => Promise<void>;
export declare const createPDFIframe: (chapterDocIndex: number, doc: Document) => HTMLIFrameElement | undefined;
export declare const handleScrollPDFPosition: (chapterDocIndex: number, readerMode: string, doc: Document) => Promise<void>;
export declare const isPDFScrolledIntoView: (element: HTMLElement, el: HTMLElement, readerMode: string, doc: any) => boolean;
export declare const getPDFVisibleText: (chapterDocIndex: number, chapterDocList: ChapterDoc[], readerMode: string) => Promise<any>;
export declare const handleHighlightPDFNode: (text: string, style: string, doc: Document) => void;
export declare const getPDFSearchResult: (keyword: string, chapterDocList: ChapterDoc[]) => Promise<{
    cfi: string;
    excerpt: string;
}[]>;
export declare const handleIOSScrollPage: (element: HTMLElement, animation: string, delta: number, doc: Document, flipToNextPage: () => void, flipToPrevPage: () => void, isMobile: string | undefined, chapterDocIndex: number, readerMode: string) => Promise<void>;
export declare const convertPageToImage: (page: any) => Promise<{
    imageURL: string;
    size: number;
}>;
export declare const showOCRProgress: (progress: number) => void;
