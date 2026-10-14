import GeneralRender from "./GeneralRender";
declare class MdRender extends GeneralRender {
    mdBuffer: ArrayBuffer;
    constructor(mdBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
}
export default MdRender;
