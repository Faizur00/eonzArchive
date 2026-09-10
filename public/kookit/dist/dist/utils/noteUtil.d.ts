import "rangy/lib/rangy-textrange";
export declare const classes: string[];
export declare const colors: string[];
export declare const lines: string[];
export declare const pdfColors: string[];
export declare const buildHighlightStyleForType: (colorCode: string | number, forPDFOverlay: boolean, isVertical?: boolean | undefined) => string;
/**
 * Batch version: resolve ALL character ranges on a clean DOM first,
 * then apply all inline highlights. This is used by renderHighlighters
 * after clearHighlight() has been called, so the DOM is already clean.
 *
 * While inline highlight spans don't change the total character count
 * (rangy walks through all text nodes regardless of nesting), the batch
 * approach is still preferred for initial rendering because:
 * 1. It avoids any edge cases with overlapping ranges after splitText()
 * 2. It's more efficient (single pass for resolve, single pass for apply)
 */
export declare const showNoteHighlightBatch: (notes: Array<{
    range: any;
    colorCode: string;
    noteKey: string;
    isNote: boolean;
    noteContent: string;
}>, handleNoteClick: any, doc: Document, iframe: any, isMobile: boolean) => void;
export declare const showNoteHighlight: (range: any, colorCode: string, noteKey: string, handleNoteClick: any, doc: Document, iframe: any, isNote: boolean, isMobile: boolean, noteContent?: string) => void;
export declare const showPDFHighlight: (selected: any, colorCode: string | number, noteKey: string, handleNoteClick: any, page: any, scale: number, doc: Document, isNote: boolean, isMobile: boolean, noteContent?: string) => void;
export declare const clearHighlight: (doc: Document) => void;
export declare const highlightRange: (range: any, colorCode: string, noteKey: string, handleNoteClick: any, doc: any, isNote?: boolean, isMobile?: boolean, noteContent?: string) => void;
export declare const clearWordDefinitions: (doc: Document) => void;
export declare const applyWordDefinitions: (definitionMap: Record<string, any>, doc: Document, lang?: string, locale?: string, rootElement?: Element | undefined) => void;
