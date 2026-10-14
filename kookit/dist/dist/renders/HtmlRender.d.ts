import GeneralRender from "./GeneralRender";
declare class HtmlRender extends GeneralRender {
    htmlBuffer: ArrayBuffer;
    constructor(htmlBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
}
export default HtmlRender;
