import Book from "../model/Book";
declare class BookHelper {
    static getRendition: (result: ArrayBuffer, config: {
        format: string;
        readerMode: string;
        charset: string;
        animation: string;
        convertChinese: string;
        parserRegex: string;
        isDarkMode: string;
        isMobile: string;
        password: string;
        isConvertPDF: string;
        backgroundColor: string;
        isScannedPDF: string;
        ocrEngine: string;
        externalWorker?: any;
    }, Kookit: any) => any;
    static generateBook(bookName: string, extension: string, md5: string, size: number, path: string, file_content: ArrayBuffer, rendition: any): Promise<Book>;
    static initMobileBook: (bookUrl: string, config: {
        format: string;
        readerMode: string;
        charset: string;
        animation: string;
        convertChinese: string;
        parserRegex: string;
        bookLocation: any;
        isDarkMode: string;
        password: string;
        isConvertPDF: string;
        platform?: string;
        backgroundColor: string;
        isScannedPDF: string;
        ocrEngine: string;
    }) => Promise<void>;
    static addMobileBook: (bookUrl: string, bookName: string, extension: string, md5: string, size: number, path: string, parserRegex?: string) => Promise<void>;
    static precacheMobileBook: (serverUrl: string, bookKey: string) => Promise<void>;
    static getPDFOcrResult: (chapterDocIndex: number, imageUrl: string) => Promise<string>;
}
export default BookHelper;
