export declare const isElectron: () => boolean;
export declare const getBlockElement: (Element: any) => HTMLElement[];
export declare const isParentBlock: (myDiv: Element) => boolean;
export declare function parseStyleToMap(styleText: string): Record<string, string>;
export declare function styleMapToString(map: Record<string, string>): string;
export declare function mergeStyleStrings(baseStyle: string, extraStyle: string): string;
export declare function getViewportSize(htmlStr: string): {
    width?: number;
    height?: number;
} | null;
export declare function getStylePxNumber(styleText: string, prop: string): number | null;
export declare function getPageWidth(element: HTMLElement, readerMode: string): number;
export declare const detectLocalLanguage: (text: string) => string;
