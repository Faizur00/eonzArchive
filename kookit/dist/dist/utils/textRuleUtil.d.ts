export interface TextRule {
    id: string;
    type: "replace" | "delete";
    pattern: string;
    replacement?: string;
    matchType: "regex" | "plain";
    scope: "all" | "book";
    bookKey?: string;
    bookName?: string;
}
export declare const clearTextRules: (doc: Document) => void;
export declare const applyTextRules: (doc: Document, rules: TextRule[]) => void;
