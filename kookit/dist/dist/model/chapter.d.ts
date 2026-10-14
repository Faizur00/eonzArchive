declare class Chapter {
    label: string;
    href: string;
    index: number;
    subitems: any[];
    constructor(label: string, href: string, index: number, subitems: any[]);
}
export default Chapter;
