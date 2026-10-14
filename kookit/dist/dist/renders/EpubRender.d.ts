import GeneralRender from "./GeneralRender";
declare class EpubRender extends GeneralRender {
    epubBuffer: ArrayBuffer;
    constructor(epubBuffer: ArrayBuffer, config: any);
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
    makeZipLoaderV2(file: any): Promise<{
        entries: {
            filename: string;
        }[];
        loadText: (name: any) => Promise<string>;
        loadBlob: (name: any) => Promise<Blob>;
        getSize: (name: any) => any;
    }>;
    makeZipLoaderV3(file: any): Promise<{
        entries: any;
        loadText: (name: any) => Promise<any>;
        loadBlob: (name: any) => Promise<any>;
        getSize: (name: any) => any;
    }>;
    getMetadata(): Promise<any>;
}
export default EpubRender;
