import GeneralRender from "./GeneralRender";
declare class MobiRender extends GeneralRender {
    mobiBuffer: ArrayBuffer;
    constructor(mobiBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
    parse(): Promise<void>;
    preCache(): Promise<string | ArrayBuffer>;
    getMetadata(): Promise<any>;
}
export default MobiRender;
