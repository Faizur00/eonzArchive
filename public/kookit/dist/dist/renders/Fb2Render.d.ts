import GeneralRender from "./GeneralRender";
declare class Fb2Render extends GeneralRender {
    fb2Buffer: ArrayBuffer;
    constructor(fb2Buffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
    getMetadata(): Promise<any>;
}
export default Fb2Render;
