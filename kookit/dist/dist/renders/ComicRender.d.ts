import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import GeneralRender from "./GeneralRender";
declare class ComicRender extends GeneralRender {
    comicBuffer: ArrayBuffer;
    readerMode: string;
    book: any;
    format: string;
    chapterList: Chapter[];
    chapterDocList: ChapterDoc[];
    element: any;
    rpc: any;
    constructor(comicBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
    makeZipLoader(file: any): Promise<{
        entries: {
            filename: string;
        }[];
        loadText: (name: any) => Promise<string>;
        loadBlob: (name: any) => Promise<Blob>;
        getSize: (name: any) => any;
    }>;
    makeTarLoader(): Promise<{
        entries: any;
        loadText: (name: any, ...args: any[]) => any;
        loadBlob: (name: any, ...args: any[]) => any;
        getSize: (name: any) => any;
    }>;
    makeRarLoader(): Promise<any>;
    make7zLoader(): Promise<{
        entries: any;
        loadText: (name: any, ...args: any[]) => any;
        loadBlob: (name: any, ...args: any[]) => any;
        getSize: (name: any) => any;
    }>;
    getRarEntries(Node: any): any;
    get7zEntries(FSNode: any): any;
    getMetadata(): Promise<any>;
}
export default ComicRender;
