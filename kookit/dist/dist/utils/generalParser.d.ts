import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
declare class GeneralParser {
    book: any;
    chapterList: Chapter[];
    flattenChapters: Chapter[];
    chapterDocList: ChapterDoc[];
    constructor(book: any);
    unescapeHtml(htmlStr: string): string;
    getChapter(toc: any): Promise<Chapter[]>;
    getChapterDoc(): Promise<ChapterDoc[]>;
    flatChapter(chapters: any): any;
    getMetadata(): Promise<any>;
}
export default GeneralParser;
