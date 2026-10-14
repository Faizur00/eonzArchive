import GeneralRender from "./GeneralRender";
declare class CacheRender extends GeneralRender {
    cacheBuffer: ArrayBuffer;
    constructor(cacheBuffer: ArrayBuffer, config: any);
    renderTo(element: HTMLElement): Promise<void>;
}
export default CacheRender;
