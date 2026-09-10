import GeneralRender from "./GeneralRender";
declare class TxtRender extends GeneralRender {
    txtBuffer: ArrayBuffer;
    charset: string;
    parserRegex: string;
    constructor(txtBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement, bookLocation?: any): Promise<void>;
    parse(bookLocation?: any): Promise<void>;
    refreshContent(): Promise<import("../model/chapter").default[]>;
    preCache(): Promise<string | ArrayBuffer>;
    getMetadata(txtBuffer: ArrayBuffer): Promise<{
        charset: string;
    }>;
}
export default TxtRender;
