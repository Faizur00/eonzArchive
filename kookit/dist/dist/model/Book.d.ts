declare class Book {
    key: string;
    name: string;
    author: string;
    description: string;
    md5: string;
    cover: string;
    format: string;
    publisher: string;
    size: number;
    page: number;
    path: string;
    charset: string;
    constructor(key: string, name: string, author: string, description: string, md5: string, cover: string, format: string, publisher: string, size: number, page: number, path: string, charset: string);
}
export default Book;
