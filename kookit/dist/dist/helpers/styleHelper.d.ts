declare class StyleHelper {
    static getDefaultCss(ConfigService: any, bookKey?: string): string;
    static getCustomCss(ConfigService: any, isTitle?: boolean): string;
    static getComicCss(ConfigService: any): string;
}
export default StyleHelper;
