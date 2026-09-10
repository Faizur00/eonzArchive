import GeneralRender from "./GeneralRender";
declare class DocxRender extends GeneralRender {
    docxBuffer: ArrayBuffer;
    constructor(docxBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
}
export default DocxRender;
